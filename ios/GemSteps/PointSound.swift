import AVFoundation

actor PointSound {
    private var player: AVAudioPlayer?

    func play(positive: Bool) {
        guard let url = Bundle.main.url(forResource: positive ? "points-earned" : "reward-complete", withExtension: "wav") else { return }
        do {
            try AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
            player = try AVAudioPlayer(contentsOf: url)
            player?.play()
        } catch {
            // Feedback audio is optional; persistence has already succeeded.
        }
    }
}
