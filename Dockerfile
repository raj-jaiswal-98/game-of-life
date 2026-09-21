# syntax=docker/dockerfile:1

FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
COPY src ./src
COPY frontend ./frontend
RUN mvn -B -q -DskipTests package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN apk add --no-cache pciutils mesa-dri-gallium ocl-icd || true
RUN addgroup -S life && adduser -S life -G life
COPY --from=build /src/target/game-of-life-0.0.1-SNAPSHOT.jar app.jar
USER life
EXPOSE 8080
ENV JAVA_OPTS=""
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
