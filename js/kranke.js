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


// -----------------------------------------
// firebase
// -----------------------------------------
const sendDataToDB = function (type, data) {
    let dataType = ''
    switch (type) {
        case 'video':
            dataType = 'video'
            break
        case 'voice':
            dataType = 'voice'
            break
        case 'text':
            dataType = 'text'
            break
    }
    db.ref(`data/${dataId}/${dataType}`).push(data)
}

// 受信処理をまとめる関数
const subscribeChildChange = function () {
    db.ref().on('child_changed', data => {
        const key = data.key

        switch (key) {
            case 'flg':
                data.val() == 1 ? faceAnalysisSequence(interval) : stopFaceAnalysisSequence(timerId)
                break
            case 'currentSkyWayKey':
                dataId = data.val()
                break
        }
    })
}



//  ---------------------------------------------------------------------
// 表情分析
//  ---------------------------------------------------------------------

// 表情分析の開始処理
const faceAnalysisSequence = function (interval) {
    timerId = setInterval(async function () {
        const img = window.__video.getImageByVideo()
        const result = await window.__video.getFaceExpressions(img)
        sendDataToDB('video', result)
    }, interval)
}

// 表情分析の終了処理
const stopFaceAnalysisSequence = function () {
    clearInterval(timerId)
}


// ------------------------------------------------------------
// 初期化 
//  ------------------------------------------------------------
// krakne側初期化処理
const databaseInit = function () {
    firebase.initializeApp(window.__FIREBASE_CONFIG)
    db = firebase.database()
    subscribeChildChange()
}

// 実行
databaseInit()

// ------------------------------------------------------------
// test
// ------------------------------------------------------------
const changeFlg = function () {
    db.ref().child('flg').get().then(snap => {
        db.ref().update({
            'flg': snap.val() == 0 ? 1 : 0
        })
    })
}
const setSkyWayKey = function () {
    db.ref().child('currentSkyWayKey').set(input.value)
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
})