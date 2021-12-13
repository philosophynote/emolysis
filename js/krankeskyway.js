let localStream;

// カメラ映像取得
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        // 成功時にvideo要素にカメラ映像をセットし、再生
        const videoElm = document.getElementById('kranke-video');
        videoElm.srcObject = stream;
        videoElm.play();
        // 着信時に相手にカメラ映像を返せるように、グローバル変数に保存しておく
        localStream = stream;
    }).catch(error => {
        // 失敗時にはエラーログを出力
        console.error('mediaDevice.getUserMedia() error:', error);
        return;
    });

//Peer作成
const peer = new Peer({
    key: __SKYWAY_KEY,
    debug: 3
});
peer.on('open', () => {
    document.getElementById('displayKrankeId').textContent = peer.id;
});

// 発信処理
document.getElementById('make-call').onclick = () => {
    const dokdorID = document.getElementById('inputDokdorId').value;
    const mediaConnection = peer.call(dokdorID, localStream);
    setEventListener(mediaConnection);
};

// イベントリスナを設置する関数
const setEventListener = mediaConnection => {
    mediaConnection.on('stream', stream => {
        // video要素にカメラ映像をセットして再生
        const videoElm = document.getElementById('dokdor-video')
        videoElm.srcObject = stream;
        videoElm.play();
    });
}

//着信処理
peer.on('call', mediaConnection => {
    mediaConnection.answer(localStream);
    setEventListener(mediaConnection);
});
// 通話開始時の処理
const callBtn = document.getElementById('make-call');
const callBox = document.querySelector('.call-box')
callBtn.addEventListener("click", function () {
    callBox.style.display = "none";
})

// メッセージ表示
const message = document.querySelector('.message');
const messageBox = Array.from(document.querySelectorAll('.messageBox'));



