package com.gameoflife.engine;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PatternsTest {

    @Test
    @DisplayName("Modular patterns should be loaded from JSON resource files")
    void testModularPatternsLoaded() {
        assertNotNull(Patterns.get("glider"), "Glider should be loaded");
        assertNotNull(Patterns.get("gosper"), "Gosper Gun should be loaded");
        assertNotNull(Patterns.get("pulsar"), "Pulsar should be loaded");
        assertNotNull(Patterns.get("notgate"), "NOT gate should be loaded");
        assertNotNull(Patterns.get("andgate"), "AND gate should be loaded");
        assertNotNull(Patterns.get("orgate"), "OR gate should be loaded");
        assertNotNull(Patterns.get("acorn"), "Acorn methuselah should be loaded");
        assertNotNull(Patterns.get("copperhead"), "Copperhead should be loaded");
        assertNotNull(Patterns.get("mwss"), "MWSS should be loaded");
        assertNotNull(Patterns.get("puffer"), "Puffer Train should be loaded");
        assertNotNull(Patterns.get("corderengine"), "Corderengine should be loaded");
        assertNotNull(Patterns.get("flipflop"), "Flip-flop should be loaded");
        assertNotNull(Patterns.get("reflector"), "Reflector should be loaded");
        assertNotNull(Patterns.get("splitter"), "Splitter should be loaded");

        assertEquals(28, Patterns.get("copperhead").cells().size(), "Copperhead should have 28 cells");
        assertEquals("logic", Patterns.get("notgate").category());
        assertEquals("logic", Patterns.get("flipflop").category());
        assertEquals("guns", Patterns.get("gosper").category());
        assertEquals("spaceships", Patterns.get("glider").category());
        assertEquals("spaceships", Patterns.get("puffer").category());
        assertFalse(Patterns.get("notgate").cells().isEmpty());
    }

    @Test
    @DisplayName("Users should be able to dynamically register and import patterns")
    void testDynamicPatternRegistration() {
        String testId = "custom-test-pattern";
        Patterns.register(testId, "Custom Test", "custom", "A user imported pattern",
                List.of(new Patterns.Offset(0, 0), new Patterns.Offset(1, 1)));

        Patterns.Pattern imported = Patterns.get(testId);
        assertNotNull(imported);
        assertEquals("Custom Test", imported.name());
        assertEquals("custom", imported.category());
        assertEquals(2, imported.cells().size());
    }
}
