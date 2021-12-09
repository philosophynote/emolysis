let timerId = ''
const faceAnalysisSequence = function (interval) {
    timerId = setInterval(async function () {
        const img = window.__video.getImageByVideo()
        const result = await window.__video.getFaceExpressions(img)
        console.log(result)
    }, interval)
}

document.addEventListener('DOMContentLoaded', function () {

    const input = document.getElementById('inputDokdorId')
    const callBtn = document.getElementById('make-call')
    console.log(callBtn)
    callBtn.addEventListener('click', function () {
        console.log('call')
        window.__video.init()
        faceAnalysisSequence(1000)
    })
})
