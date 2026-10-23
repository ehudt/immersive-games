// swift-tools-version:5.9
import PackageDescription

// Pure counting logic (Hebrew number parsing and judging), shared by the app
// and testable on its own: `swift test` in this folder.
let package = Package(
    name: "CountingCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "CountingCore", targets: ["CountingCore"])],
    targets: [
        .target(name: "CountingCore"),
        .testTarget(name: "CountingCoreTests", dependencies: ["CountingCore"]),
    ]
)
