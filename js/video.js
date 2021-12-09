window.__video = {
    canvas: null,
    ctx: null,
    video: null,
    videoWidth: 0,
    videoHeight: 0,
    init: function () {
        this.video = document.getElementById('kranke-video')
        this.videoWidth = this.video.clientWidth
        this.videoHeight = this.video.clientHeight

        this.canvas = document.createElement('canvas')
        this.canvas.width = this.videoWidth
        this.canvas.height = this.videoHeight

        this.ctx = this.canvas.getContext('2d')
    },

    getImageByVideo: function () {
        this.ctx.drawImage(this.video, 0, 0, this.videoWidth, this.videoHeight)
        const imageData = this.ctx.getImageData(0, 0, this.videoWidth, this.videoHeight)
        const data = imageData.data
        for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
            data[i] = avg
            data[i + 1] = avg
            data[i + 2] = avg
        }
        this.ctx.putImageData(imageData, 0, 0)
        const d = this.canvas.toDataURL('image/jpeg')
        const img = document.createElement('img')
        img.src = d
        return img
    },

    getFaceExpressions: async function (img) {
        await faceapi.nets.tinyFaceDetector.load("../lib/models/");
        await faceapi.nets.faceExpressionNet.load("../lib/models/");

        const detectionsWithExpressions = await faceapi.detectAllFaces(img,
            new faceapi.TinyFaceDetectorOptions()).withFaceExpressions()
        return detectionsWithExpressions[0].expressions
    }

}
