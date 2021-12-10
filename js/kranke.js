let timerId = ''
let interval = 1000
let dataId = ''
let db = null


// db上のフラグがtrueになったらstartCallbackが実行される
const subscribeFlg = function () {
    db.ref().on('child_changed', data => {
        // 暫定処理
        if (data.key === 'flg') {
            if (data.val() == 1) {
                faceAnalysisSequence(interval)
            } else {
                stopFaceAnalysisSequence(timerId)
            }
        }

    })
}


const init = function (skywayKey) {
    dataId = skywayKey
    firebase.initializeApp(window.__FIREBASE_CONFIG)
    db = firebase.database()
    subscribeFlg(console.log)
}

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

// test
const changeFlg = function () {
    db.ref().child('flg').get().then(snap => {
        db.ref().update({
            'flg': snap.val() == 0 ? 1 : 0
        })
    })
}

const faceAnalysisSequence = function (interval) {
    timerId = setInterval(async function () {
        const img = window.__video.getImageByVideo()
        const result = await window.__video.getFaceExpressions(img)
        sendDataToDB('video', result)
    }, interval)
}

const stopFaceAnalysisSequence = function () {
    clearInterval(timerId)
}



const input = document.getElementById('inputDokdorId')
const cBtn = document.getElementById('make-call')
init('hoge')

// test
const tBtn = document.getElementById('tBtn')


tBtn.addEventListener('click', function () {
    changeFlg()
    console.log('test')
})


cBtn.addEventListener('click', function () {
    window.__video.init()
    // faceAnalysisSequence(1000)
})