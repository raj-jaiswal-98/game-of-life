package com.gameoflife.engine;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Modular Pattern Catalog for Conway's Game of Life.
 *
 * Patterns are stored in modular JSON resource files under classpath:patterns/**\/*.json.
 * Additional patterns can be dynamically registered or imported by users at runtime.
 */
public final class Patterns {

    public record Offset(int row, int col) {
    }

    public record Pattern(String id, String name, String category, String description, List<Offset> cells) {
        public Pattern(String id, String name, String description, List<Offset> cells) {
            this(id, name, "other", description, cells);
        }
    }

    private static final Map<String, Pattern> CATALOG = new ConcurrentHashMap<>();

    static {
        loadModularPatterns();
    }

    private Patterns() {
    }

    public static Pattern get(String id) {
        if (id == null) return null;
        return CATALOG.get(id.toLowerCase());
    }

    public static Set<String> ids() {
        return CATALOG.keySet();
    }

    public static List<Pattern> all() {
        return List.copyOf(CATALOG.values());
    }

    public static void register(Pattern pattern) {
        if (pattern != null && pattern.id() != null) {
            CATALOG.put(pattern.id().toLowerCase(), pattern);
        }
    }

    public static void register(String id, String name, String description, List<Offset> cells) {
        register(new Pattern(id, name, "other", description, cells));
    }

    public static void register(String id, String name, String category, String description, List<Offset> cells) {
        register(new Pattern(id, name, category, description, cells));
    }

    public static void clear() {
        CATALOG.clear();
    }

    /**
     * Scans and loads all modular pattern JSON files from classpath:patterns/**\/*.json
     */
    public static void loadModularPatterns() {
        try {
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            Resource[] resources = resolver.getResources("classpath*:patterns/**/*.json");
            ObjectMapper mapper = new ObjectMapper();

            for (Resource resource : resources) {
                try (InputStream is = resource.getInputStream()) {
                    PatternFileDTO dto = mapper.readValue(is, PatternFileDTO.class);
                    if (dto != null && dto.id != null) {
                        List<Offset> offsets = (dto.cells == null) ? List.of() :
                                dto.cells.stream().map(c -> new Offset(c.row, c.col)).toList();
                        register(new Pattern(dto.id, dto.name, dto.category != null ? dto.category : "other", dto.description, offsets));
                    }
                } catch (Exception e) {
                    System.err.println("Failed to load pattern file: " + resource.getFilename() + " (" + e.getMessage() + ")");
                }
            }
        } catch (Exception e) {
            System.err.println("Modular pattern scanner notification: " + e.getMessage());
        }

        // Fallback in case classpath scanning is running in a stripped unit-test environment
        if (CATALOG.isEmpty()) {
            register("glider", "Glider", "spaceships", "Small spaceship that travels diagonally",
                    List.of(new Offset(0, 1), new Offset(1, 2), new Offset(2, 0), new Offset(2, 1), new Offset(2, 2)));
            register("blinker", "Blinker", "oscillators", "Period-2 oscillator",
                    List.of(new Offset(0, 0), new Offset(0, 1), new Offset(0, 2)));
            register("block", "Block", "still", "Still life 2x2 square",
                    List.of(new Offset(0, 0), new Offset(0, 1), new Offset(1, 0), new Offset(1, 1)));
        }
    }

    private static class PatternFileDTO {
        public String id;
        public String name;
        public String category;
        public String description;
        public List<OffsetDTO> cells;
    }

    private static class OffsetDTO {
        public int row;
        public int col;
    }
}
