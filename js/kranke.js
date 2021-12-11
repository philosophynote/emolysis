let timerId = ''
let interval = 1000
let dataId = ''
let db = null


// -----------------------------------------
// 概要
//  databaseInitを実行するとfirebaseの初期化処理が行われる
//  subscribeChildChange関数によってflgとskywayのkeyへの監視が行われる
//  flgが1の時、それぞれの分析シークエンスが始まる
// -----------------------------------------


//  ---------------------------------------------------------------------
// 表情分析
//  ---------------------------------------------------------------------

// 表情分析の開始処理
const faceAnalysisSequence = function (interval) {
    timerId = setInterval(async function () {
        const img = window.__video.getImageByVideo()
        const result = await window.__video.getFaceExpressions(img)
        console.log(result)
        __DB.sendData('video', result)
    }, interval)
}

// 表情分析の終了処理
const stopFaceAnalysisSequence = function () {
    clearInterval(timerId)
}


// ------------------------------------------------------------
// 初期化 
//  ------------------------------------------------------------
__DB.init()
__DB.subscribeChildChange()

// ------------------------------------------------------------
// test
// ------------------------------------------------------------
const changeFlg = function () {
    __DB.toggleFlg()
    faceAnalysisSequence(interval)
}
const setSkyWayKey = function () {
    __DB.setDataId(input.value)
    console.log(__DB)
}


const tBtn = document.getElementById('tBtn')
const input = document.getElementById('inputDokdorId')
const cBtn = document.getElementById('make-call')

tBtn.addEventListener('click', function () {
    changeFlg()
    console.log('test')
})

cBtn.addEventListener('click', function () {
    window.__video.init()
    setSkyWayKey()
    __voice.executeAnalysis()
})