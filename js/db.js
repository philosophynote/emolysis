window.__DB = {
    fb: null,
    dataId: '',
    sendFlg: 0,
    // Firebaseから取得した感情を格納するオブジェクト
    emotionObjectFromFirebase : {
        t_positive : 0,
        t_negative : 0,
        f_anger: 0,
        f_disgust: 0,
        f_fear: 0,
        f_happiness: 0,
        f_neutral: 0,
        f_sadness: 0,
        f_surprise: 0,
        v_anger: 0,
        v_calm: 0,
        v_energy: 0,
        v_joy: 0,
        v_sorrow: 0
    },
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
        this.fb.ref(`video/${this.dataId}`).on('child_added', function(data){
            __DB.emotionObjectFromFirebase.f_anger = data.val().angry
            __DB.emotionObjectFromFirebase.f_disgust = data.val().disgusted
            __DB.emotionObjectFromFirebase.f_fear = data.val().fearful
            __DB.emotionObjectFromFirebase.f_happiness = data.val().happy
            __DB.emotionObjectFromFirebase.f_neutral = data.val().neutral
            __DB.emotionObjectFromFirebase.f_sadness = data.val().sad
            __DB.emotionObjectFromFirebase.f_surprise = data.val().surprised
        })
        this.fb.ref(`voice/${this.dataId}`).on('child_added', function(data){
            __DB.emotionObjectFromFirebase.v_anger = data.val().anger
            __DB.emotionObjectFromFirebase.v_calm = data.val().calm
            __DB.emotionObjectFromFirebase.v_energy = data.val().energy
            __DB.emotionObjectFromFirebase.v_joy = data.val().joy
            __DB.emotionObjectFromFirebase.v_sorrow = data.val().sorrow
        })
        this.fb.ref(`text/${this.dataId}`).on('child_added', function(data){
            __DB.emotionObjectFromFirebase.t_negative = data.val().negative
            __DB.emotionObjectFromFirebase.t_positive = data.val().positive
        })
    }
}

