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
        this.fb.ref('state/').update({ 'currentSkyWayKey': dataId })
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
        this.fb.ref(`${dataType}/${this.dataId}/`).push(data)
    },

    // 終了時のメッセージ送信処理
    sendMsgNumber: function (number) {
        this.fb.ref('msg').update({ imgNumber: number })
    },

    // データ送受信のフラグの開始
    switchFlgStart: function () {
        this.fb.ref('state/').update({ 'flg': 1 })
    },

    // データ送受信のフラグの停止
    switchFlgStop: function () {
        this.fb.ref().get(snap => {
            console.log(snap.val())
        })
        this.fb.ref('state/').update({ 'flg': 0 })
    },

    // データ送受信のフラグの切り替え
    toggleFlg: function () {
        this.fb.ref('state/').child('flg').get().then(snap => {
            this.fb.ref('state/').update({
                'flg': snap.val() == 0 ? 1 : 0
            })
        })
    },
    // 受信処理をまとめる関数
    // 分析スタート処理と分析ストップ処理をうけとって、
    // DBの変更のコールバックとして設定する
    subscribeStateChange: function () {
        this.fb.ref('state/').on('child_changed', data => {
            const key = data.key
            switch (key) {
                case 'flg':
                    this.sendFlg = data.val()
                    break
                case 'currentSkyWayKey':
                    __DB.dataId = data.val()
                    break
            }
        })
    },

    // 受信側の処理
    subscribeDataAdded: function () {
        console.log(__DB.dataId)
        this.fb.ref(`video/${this.dataId}`).on('child_added', data => {
            console.log('video')
            console.log(data.key)
            console.log(data.val())
        })
        this.fb.ref(`voice/${this.dataId}`).on('child_added', data => {
            console.log('voice')
            console.log(data.key)
            console.log(data.val())
        })
        this.fb.ref(`text/${this.dataId}`).on('child_added', data => {
            console.log('text')
            console.log(data.key)
            console.log(data.val())
        })
    }
}

