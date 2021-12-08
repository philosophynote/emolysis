const cameraSize = { w: 360, h: 240 };
const canvasSize = { w: 360, h: 240 };
const resolution = { w: 1080, h: 720 };
let video;
let media;
let canvas;
let canvasCtx;
let img = document.getElementById('myImage')
console.log(img)
// video要素をつくる
video = document.createElement('video');
video.id = 'video';
video.width = cameraSize.w;
video.height = cameraSize.h;
video.autoplay = true;
document.getElementById('videoPreview').appendChild(video);

// video要素にWebカメラの映像を表示させる
media = navigator.mediaDevices.getUserMedia({
  audio: false,
  video: {
    width: { ideal: resolution.w },
    height: { ideal: resolution.h }
  }
}).then(function (stream) {
  video.srcObject = stream;
});

// canvas要素をつくる
canvas = document.createElement('canvas');
canvas.id = 'canvas';
canvas.width = canvasSize.w;
canvas.height = canvasSize.h;
// document.getElementById('canvasPreview').appendChild(canvas);

// コンテキストを取得する
canvasCtx = canvas.getContext('2d');

// video要素の映像をcanvasに描画する

async function _canvasUpdate() {
  const video = document.getElementById('video');
  const canvas = document.createElement('canvas');
  const canvasCtx = canvas.getContext('2d');

  // コンテキストオブジェクトにvideoのdomを渡して画像を描画する
  canvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);

  var imageData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
  // imageDataの中からピクセルの情報だけ取得
  var data = imageData.data;
  for (var i = 0; i < data.length; i += 4) {
    var avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = avg; // red
    data[i + 1] = avg; // green
    data[i + 2] = avg; // blue
  }
  canvasCtx.putImageData(imageData, 0, 0);
  const d = canvas.toDataURL("image/jpeg")
  const img = document.createElement("img")
  img.src = d
  await faceapi.nets.tinyFaceDetector.load("lib/models/");
  await faceapi.nets.faceExpressionNet.load("lib/models/");

  const detectionsWithExpressions = await faceapi.detectAllFaces(img,
    new faceapi.TinyFaceDetectorOptions()).withFaceExpressions()
  // その中のexpressions的なやつに感情が入ってる
  console.log(detectionsWithExpressions);
};

let timerId = null
const saveBtn = document.getElementById('js-startRecordingBtn')

saveBtn.addEventListener('click', function () {
  // timerId = setInterval(function () {
  //   _canvasUpdate()
  // }, 1000)
  _canvasUpdate()

})





const clearBtn = document.getElementById('js-cancelRecordingBtn')

clearBtn.addEventListener('click', function () {
  clearInterval(timerId)
})