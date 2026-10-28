import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

/**
 * Enquiry service: receives contact-form posts, validates them, stores each one in a file
 * and (optionally) forwards it to a chat webhook such as Discord.
 *
 * Build: javac EnquiryServer.java      Run: java EnquiryServer
 * Env:   PORT (8080), ALLOWED_ORIGINS (comma list), DATA_FILE (enquiries.jsonl),
 *        NOTIFY_WEBHOOK_URL (optional), NOTIFY_JSON_KEY ("content" for Discord, "text" for Slack)
 */
public class EnquiryServer {
    static final int MAX_BODY = 10_000;          // bytes
    static final int RATE_LIMIT = 5;             // requests per IP per hour
    static final long WINDOW_MS = 3_600_000L;
    static final Set<String> PLANS = Set.of(
            "General enquiry", "Basic Website", "Editable Website", "Fully Dynamic Website");
    static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    static final Set<String> allowedOrigins = new HashSet<>();
    static final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();
    static final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    static Path dataFile;
    static String webhookUrl;
    static String webhookKey;

    public static void main(String[] args) throws IOException {
        int port = Integer.parseInt(env("PORT", "8080"));
        for (String o : env("ALLOWED_ORIGINS", "http://localhost:5173").split(",")) {
            if (!o.isBlank()) allowedOrigins.add(o.trim());
        }
        dataFile = Paths.get(env("DATA_FILE", "enquiries.jsonl"));
        webhookUrl = env("NOTIFY_WEBHOOK_URL", "");
        webhookKey = env("NOTIFY_JSON_KEY", "content");

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/health", ex -> respond(ex, 200, "{\"ok\":true}"));
        server.createContext("/api/enquiry", EnquiryServer::handleEnquiry);
        server.setExecutor(Executors.newFixedThreadPool(8));
        server.start();
        System.out.println("Enquiry service listening on port " + port);
    }

    static void handleEnquiry(HttpExchange ex) throws IOException {
        try {
            String method = ex.getRequestMethod();
            if (method.equals("OPTIONS")) { respond(ex, 204, ""); return; }
            if (!method.equals("POST")) { respond(ex, 405, error("Use POST.")); return; }

            byte[] raw = ex.getRequestBody().readNBytes(MAX_BODY + 1);
            if (raw.length > MAX_BODY) { respond(ex, 413, error("Request too large.")); return; }
            Map<String, String> f = parseForm(new String(raw, StandardCharsets.UTF_8));

            // Honeypot: real visitors never see this field, bots fill it in.
            if (!f.getOrDefault("website", "").isBlank()) { respond(ex, 200, "{\"ok\":true}"); return; }

            String name = f.getOrDefault("name", "").trim();
            String email = f.getOrDefault("email", "").trim();
            String phone = f.getOrDefault("phone", "").trim();
            String business = f.getOrDefault("business", "").trim();
            String message = f.getOrDefault("message", "").trim();
            String plan = f.getOrDefault("plan", "").trim();
            if (!PLANS.contains(plan)) plan = "General enquiry";

            if (name.isEmpty() || name.length() > 100) { respond(ex, 400, error("Please enter your name.")); return; }
            if (email.length() > 254 || !EMAIL.matcher(email).matches()) { respond(ex, 400, error("Please enter a valid email.")); return; }
            if (phone.length() > 30 || business.length() > 120) { respond(ex, 400, error("Phone or business name is too long.")); return; }
            if (message.isEmpty() || message.length() > 2000) { respond(ex, 400, error("Please write a message (up to 2000 characters).")); return; }

            // Only valid submissions count towards the limit, so a typo never locks a real visitor out.
            if (!allow(clientIp(ex))) {
                respond(ex, 429, error("Too many requests. Please try again later."));
                return;
            }

            String record = "{\"time\":\"" + Instant.now() + "\",\"plan\":" + q(plan) + ",\"name\":" + q(name)
                    + ",\"email\":" + q(email) + ",\"phone\":" + q(phone) + ",\"business\":" + q(business)
                    + ",\"message\":" + q(message) + "}";
            store(record);
            notifyWebhook("New website enquiry\nPlan: " + plan + "\nName: " + name + "\nEmail: " + email
                    + "\nPhone: " + (phone.isEmpty() ? "-" : phone)
                    + "\nBusiness: " + (business.isEmpty() ? "-" : business) + "\n\n" + message);
            respond(ex, 200, "{\"ok\":true}");
        } catch (Exception e) {
            System.err.println("Enquiry error: " + e);
            respond(ex, 500, error("Something went wrong on our side."));
        }
    }

    // ---- helpers ----
    static String env(String key, String fallback) {
        String v = System.getenv(key);
        return (v == null || v.isBlank()) ? fallback : v;
    }

    static Map<String, String> parseForm(String body) {
        Map<String, String> out = new HashMap<>();
        int n = 0;
        for (String pair : body.split("&")) {
            if (pair.isEmpty() || ++n > 20) continue;
            int i = pair.indexOf('=');
            String k = URLDecoder.decode(i < 0 ? pair : pair.substring(0, i), StandardCharsets.UTF_8);
            String v = i < 0 ? "" : URLDecoder.decode(pair.substring(i + 1), StandardCharsets.UTF_8);
            out.put(k, v);
        }
        return out;
    }

    static String clientIp(HttpExchange ex) {
        String xff = ex.getRequestHeaders().getFirst("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return ex.getRemoteAddress().getAddress().getHostAddress();
    }

    static boolean allow(String ip) {
        long now = System.currentTimeMillis();
        Deque<Long> q = hits.computeIfAbsent(ip, k -> new ArrayDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && now - q.peekFirst() > WINDOW_MS) q.pollFirst();
            if (q.size() >= RATE_LIMIT) return false;
            q.addLast(now);
            return true;
        }
    }

    static synchronized void store(String line) throws IOException {
        Files.writeString(dataFile, line + "\n", StandardCharsets.UTF_8,
                StandardOpenOption.CREATE, StandardOpenOption.APPEND);
    }

    static void notifyWebhook(String text) {
        if (webhookUrl.isEmpty()) return;
        String msg = text.length() > 1800 ? text.substring(0, 1800) : text;
        HttpRequest req = HttpRequest.newBuilder(URI.create(webhookUrl))
                .timeout(Duration.ofSeconds(8))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{" + q(webhookKey) + ":" + q(msg) + "}"))
                .build();
        http.sendAsync(req, HttpResponse.BodyHandlers.discarding())
                .thenAccept(r -> { if (r.statusCode() >= 300) System.err.println("Webhook status " + r.statusCode()); })
                .exceptionally(e -> { System.err.println("Webhook failed: " + e); return null; });
    }

    static String q(String s) {                       // JSON string literal
        StringBuilder b = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                default:
                    if (c < 0x20) b.append(String.format("\\u%04x", (int) c)); else b.append(c);
            }
        }
        return b.append('"').toString();
    }

    static String error(String msg) { return "{\"ok\":false,\"error\":" + q(msg) + "}"; }

    static void respond(HttpExchange ex, int code, String body) throws IOException {
        String origin = ex.getRequestHeaders().getFirst("Origin");
        if (origin != null && allowedOrigins.contains(origin)) {
            ex.getResponseHeaders().set("Access-Control-Allow-Origin", origin);
            ex.getResponseHeaders().set("Vary", "Origin");
            ex.getResponseHeaders().set("Access-Control-Allow-Methods", "POST, OPTIONS");
            ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
        }
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        if (bytes.length == 0) {
            ex.sendResponseHeaders(code, -1);
        } else {
            ex.sendResponseHeaders(code, bytes.length);
            ex.getResponseBody().write(bytes);
        }
        ex.close();
    }
}
