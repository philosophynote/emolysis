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
// graph
// ------------------------------------------------------------


window.__graph = {
    dateArray : new Array,
    readyGraphArray : new Array(),
    
    // 公式に代入した結果を格納するオブジェクト
    graphArrayObject : {
        o_anger: new Array(),
        o_joy: new Array(),
        o_sorrow: new Array(),
        o_energy: new Array(),
        o_calm: new Array()
    },

    //「岡田さんの公式」ver3
    calcAnger : function(emotionObject){
        anger = emotionObject.v_anger  + 0.5 * emotionObject.t_negative + (emotionObject.f_anger + emotionObject.f_disgust) / 2
        return anger
    },
    calcJoy : function(emotionObject){
        joy = emotionObject.v_joy  + 0.5 * emotionObject.t_positive + emotionObject.f_happiness / 1.2
        return joy
    },
    calcSorrow : function(emotionObject){
        sorrow = 0.7 * emotionObject.v_sorrow  + 0.5 * emotionObject.t_negative + emotionObject.f_sadness
        return sorrow
    },    
    calcEnergy : function(emotionObject){
        energy = 0.7 * emotionObject.v_energy  + 0.5 * emotionObject.t_positive + (emotionObject.f_surprise) / 2 / 1.2
        return energy
    },
    calcCalm : function(emotionObject){
        calm = 0.7 * emotionObject.v_calm  + 0.5 * (emotionObject.t_positive + emotionObject.t_negative) + emotionObject.f_neutral
        return calm
    },


    // 計算した結果をグラフ描画用の配列に格納する
    // 引数：（公式代入前のオブジェクト，グラフ描画用の配列が入ったオブジェクト）
    // 返り値：グラフ描画用の配列が入ったオブジェクト
    makeGraphArrayObject : (beforeCalcObject,graphArrayObject) => {
        graphArrayObject.o_anger.push(__graph.calcAnger(beforeCalcObject)),
        graphArrayObject.o_joy.push(__graph.calcJoy(beforeCalcObject)),
        graphArrayObject.o_sorrow.push(__graph.calcSorrow(beforeCalcObject)),
        graphArrayObject.o_energy.push(__graph.calcEnergy(beforeCalcObject)),
        graphArrayObject.o_calm.push(__graph.calcCalm(beforeCalcObject))
        return graphArrayObject
    },

    readyDrawGraph : function(dateArray,arrayObject){
        // グラフの描画情報が入ったオブジェクトを作成する
        // x：時間,y：岡田さんの公式の計算結果,type：scatter(自動的に折れ線グラフとなる),name(右に表示される凡例名)
        const o_anger_g = {
        x: dateArray,
        y: arrayObject.o_anger,
        type: 'scatter',
        name: 'anger'
        };
        const o_joy_g = {
        x: dateArray,
        y: arrayObject.o_joy,
        type: 'scatter',
        name: 'joy'
        };
        const o_sorrow_g = {
        x: dateArray,
        y: arrayObject.o_sorrow,
        type: 'scatter',
        name: 'sorrow'
        };
        const o_energy_g = {
        x: dateArray,
        y: arrayObject.o_energy,
        type: 'scatter',
        name: 'energy'
        };
        const o_calm_g = {
        x: dateArray,
        y: arrayObject.o_calm,
        type: 'scatter',
        name: 'calm'
        };


        const graphArray = [o_anger_g, o_joy_g, o_sorrow_g, o_energy_g, o_calm_g];
        console.log(graphArray)
        return graphArray
    },

    // グラフを描画する関数
    // 引数：各APIから受信した感情の値が入ったオブジェクト
    drawEmotionGraph : function(emotionObject){
        console.log("----");
        // グラフ横軸の設定(グラフの描画時刻の配列を作成する)
        let graphDate = new Date();///発火した時の時刻を取得
        this.dateArray.push(graphDate);
        // 計算結果の配列をオブジェクトに入れる
        afterPushObject = __graph.makeGraphArrayObject(emotionObject,__graph.graphArrayObject)
        this.readyGraphArray = __graph.readyDrawGraph(this.dateArray,afterPushObject)
        //plot.jsのレイアウト
        const graphLayout = {
        width: 750,
        height: 500,
        yaxis: {
            range: [0, 2.2],
            autorange: false
        },
        };
        // グラフ描画(グラフを描画する場所のid,座標情報,レイアウト情報)
        Plotly.newPlot("myface", this.readyGraphArray,graphLayout) 
        //10秒に１回グラフ描写する
        setTimeout(function () {
            __graph.drawEmotionGraph(__DB.emotionObjectFromFirebase);
        }, __GRAPH_DRAW_TIME)
    }
} 

// ------------------------------------------------------------
// test
// ------------------------------------------------------------
const doctorStartBtn = document.getElementById('startOnlineAnalysis')
doctorStartBtn.addEventListener('click', function () {
    console.log('doctor start')
    __DB.switchFlgStart()
    __graph.drawEmotionGraph(__DB.emotionObjectFromFirebase)
})




