FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY EnquiryServer.java .
RUN javac -d out EnquiryServer.java

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/out .
CMD ["java", "-Xmx256m", "EnquiryServer"]
