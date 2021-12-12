// ------------------------------------------------------------
// 初期化
// ------------------------------------------------------------

const startBtn = document.getElementById('make-call')
startBtn.addEventListener('click', function () {
    const doctorId = document.getElementById('displayDokdorId').textContent
    __DB.sendDataId(doctorId)
    __DB.setDataId(doctorId)
    __DB.subscribeDataAdded()
})
__DB.init()
// ------------------------------------------------------------
// test
// ------------------------------------------------------------
const doctorStartBtn = document.getElementById('startOnlineAnalysis')
doctorStartBtn.addEventListener('click', function () {
    console.log('doctor start')
    __DB.switchFlgStart()
})

