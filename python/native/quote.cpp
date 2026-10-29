// quote.cpp - price engine for the website estimator. Pure function, no I/O.
// Build (Linux): g++ -O2 -shared -fPIC -o libquote.so native/quote.cpp
#include <cstddef>

namespace {
constexpr int BASE[3]         = {199, 319, 549};  // plan prices in USD
constexpr int INCLUDED_INT[3] = {0, 1, 2};        // integrations included in each plan
constexpr int PAGE_PRICE = 15;                    // per extra page
constexpr int INTEGRATION_PRICE = 45;             // per integration beyond the included ones
constexpr int GATEWAY_PRICE = 60;                 // per extra payment gateway
constexpr int RUSH_PERCENT = 20;                  // rush delivery surcharge
}  // namespace

// plan: 0 = Basic, 1 = Editable, 2 = Fully Dynamic
// out[0..5] = base, extra pages, integrations, gateways, rush fee, total (whole USD)
// returns 0 on success; -1 null output, -2 unknown plan, -3 payments not on this plan, -4 value out of range
extern "C" int quote_usd(int plan, int extra_pages, int integrations,
                         int extra_gateways, int rush, int* out) {
    if (out == nullptr) return -1;
    if (plan < 0 || plan > 2) return -2;
    if (extra_pages < 0 || extra_pages > 50 || integrations < 0 || integrations > 20 ||
        extra_gateways < 0 || extra_gateways > 5 || (rush != 0 && rush != 1))
        return -4;
    if (plan != 2 && extra_gateways > 0) return -3;

    const int base = BASE[plan];
    const int pages = extra_pages * PAGE_PRICE;
    const int paid = integrations > INCLUDED_INT[plan] ? integrations - INCLUDED_INT[plan] : 0;
    const int integ = paid * INTEGRATION_PRICE;
    const int gateways = extra_gateways * GATEWAY_PRICE;
    const int subtotal = base + pages + integ + gateways;
    const int rush_fee = rush ? (subtotal * RUSH_PERCENT + 50) / 100 : 0;  // nearest dollar

    out[0] = base;
    out[1] = pages;
    out[2] = integ;
    out[3] = gateways;
    out[4] = rush_fee;
    out[5] = subtotal + rush_fee;
    return 0;
}
