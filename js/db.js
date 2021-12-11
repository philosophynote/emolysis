window.__DB = {
    fb: null,
    dataId: '',
    sendFlg: 0,
    // firebaseの初期化処理
    init: function () {
        firebase.initializeApp(window.__FIREBASE_CONFIG)
        this.fb = firebase.database()
        this.switchFlgStop()
    },

    // データの送り先の設定処理（kranke側）
    setDataId: function (id) {
        this.dataId = id
    },

    // データの送り先の設定処理（ドクター側）
    sendDataId: function (dataId) {
        console.log(dataId)
        this.fb.ref().update({ 'currentSkyWayKey': dataId })
    },

    // データの送信処理
    sendData: function (type, data) {
        console.log(this.sendFlg)
        if (this.sendFlg == 0) return
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
        this.fb.ref(`data/${this.dataId}/${dataType}`).push(data)
    },

    // データ送受信のフラグの開始
    switchFlgStart: function () {
        this.fb.ref().update({ 'flg': 1 })
    },

    // データ送受信のフラグの停止
    switchFlgStop: function () {
        this.fb.ref().get(snap => {
            console.log(snap.val())
        })
        this.fb.ref().update({ 'flg': 0 })
    },

    // データ送受信のフラグの切り替え
    toggleFlg: function () {
        this.fb.ref().child('flg').get().then(snap => {
            this.fb.ref().update({
                'flg': snap.val() == 0 ? 1 : 0
            })
        })
    },
    // 受信処理をまとめる関数
    // 分析スタート処理と分析ストップ処理をうけとって、
    // DBの変更のコールバックとして設定する
    subscribeStateChange: function () {
        console.log('before subscribe')
        console.log(__DB)
        this.fb.ref().on('child_changed', data => {
            console.log('subscribe')
            const key = data.key
            switch (key) {
                case 'flg':
                    console.log('flg changed')
                    this.sendFlg = data.val()
                    break
                case 'currentSkyWayKey':
                    dataId = data.val()
                    break
            }
        })
    },
    subscribeDataAdded: function () {
        this.fb.ref(`data/${this.dataId}`).on('child_added', data => {
            console.log(data.key)
            console.log(data.val())
        })
    }
}

