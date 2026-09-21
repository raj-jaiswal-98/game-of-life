package com.gameoflife.api;

import com.gameoflife.api.dto.BenchmarkRequest;
import com.gameoflife.api.dto.BenchmarkResponse;
import com.gameoflife.api.dto.CellRequest;
import com.gameoflife.api.dto.EngineRequest;
import com.gameoflife.api.dto.GameStateResponse;
import com.gameoflife.api.dto.GridSizeRequest;
import com.gameoflife.api.dto.PatternInfo;
import com.gameoflife.api.dto.PaintRequest;
import com.gameoflife.api.dto.PatternStampRequest;
import com.gameoflife.api.dto.RandomizeRequest;
import com.gameoflife.engine.Patterns;
import com.gameoflife.service.GameService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/game")
public class GameController {

    private final GameService gameService;

    public GameController(GameService gameService) {
        this.gameService = gameService;
    }

    @GetMapping
    public GameStateResponse current() {
        return gameService.snapshot();
    }

    @GetMapping("/patterns")
    public List<PatternInfo> patterns() {
        return Patterns.all().stream()
                .map(pattern -> new PatternInfo(pattern.id(), pattern.name(), pattern.description(), pattern.cells()))
                .toList();
    }

    @GetMapping("/hardware")
    public com.gameoflife.api.dto.HardwareInfo hardware() {
        return new com.gameoflife.api.dto.HardwareInfo(
                com.gameoflife.engine.HardwareAccelerator.isGpuAvailable(),
                com.gameoflife.engine.HardwareAccelerator.getDeviceName(),
                com.gameoflife.engine.HardwareAccelerator.getAvailableProcessors(),
                System.getProperty("os.name") + " " + System.getProperty("os.version"),
                System.getProperty("java.version")
        );
    }

    @PostMapping("/engine")
    public GameStateResponse setEngine(@RequestBody EngineRequest request) {
        return gameService.setEngineMode(request.mode());
    }

    @PostMapping("/benchmark")
    public BenchmarkResponse benchmark(@RequestBody(required = false) BenchmarkRequest request) {
        return gameService.benchmark(request);
    }

    @PostMapping("/reset")
    public GameStateResponse reset(@RequestBody(required = false) GridSizeRequest request) {
        int rows = request == null ? GameService.DEFAULT_ROWS : request.rows();
        int cols = request == null ? GameService.DEFAULT_COLS : request.cols();
        return gameService.reset(rows, cols);
    }

    @PostMapping("/clear")
    public GameStateResponse clear() {
        return gameService.clear();
    }

    @PostMapping("/toggle")
    public GameStateResponse toggle(@RequestBody CellRequest request) {
        return gameService.toggle(request.row(), request.col());
    }

    @PostMapping("/paint")
    public GameStateResponse paint(@RequestBody PaintRequest request) {
        return gameService.setCell(request.row(), request.col(), request.alive());
    }

    @PostMapping("/step")
    public GameStateResponse step() {
        return gameService.step();
    }

    @PostMapping("/random")
    public GameStateResponse random(@RequestBody(required = false) RandomizeRequest request) {
        double density = request == null ? 0.28 : request.density();
        return gameService.randomize(density);
    }

    @PostMapping("/pattern")
    public GameStateResponse pattern(@RequestBody PatternStampRequest request) {
        return gameService.stampPattern(request.id(), request.row(), request.col());
    }
}
