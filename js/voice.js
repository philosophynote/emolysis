// export WAV from audio float data
voiceObject = {
    audio_sample_rate: 11025,
    bufferSize: 1024,
    recordTime: window.__VOICE_RECORDING_TIME,
    sleepTime: window.__VOICE_INTERVAL,


    voiceAnalysis: function (audioData) {
        const encodeWAV = function (samples, sampleRate) {
            let buffer = new ArrayBuffer(44 + samples.length * 2);
            let view = new DataView(buffer);

            const writeString = function (view, offset, string) {
                for (let i = 0; i < string.length; i++) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            };

            const floatTo16BitPCM = function (output, offset, input) {
                for (let i = 0; i < input.length; i++, offset += 2) {
                    let s = Math.max(-1, Math.min(1, input[i]));
                    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                }
            };
            writeString(view, 0, 'RIFF');  // RIFFヘッダ
            view.setUint32(4, 32 + samples.length * 2, true); // これ以降のファイルサイズ
            writeString(view, 8, 'WAVE'); // WAVEヘッダ
            writeString(view, 12, 'fmt '); // fmtチャンク
            view.setUint32(16, 16, true); // fmtチャンクのバイト数
            view.setUint16(20, 1, true); // フォーマットID
            view.setUint16(22, 1, true); // チャンネル数
            view.setUint32(24, sampleRate, true); // サンプリングレート
            view.setUint32(28, sampleRate * 2, true); // データ速度
            view.setUint16(32, 2, true); // ブロックサイズ
            view.setUint16(34, 16, true); // サンプルあたりのビット数
            writeString(view, 36, 'data'); // dataチャンク
            view.setUint32(40, samples.length * 2, true); // 波形データのバイト数
            floatTo16BitPCM(view, 44, samples); // 波形データ  
            return view;
        };


        const mergeBuffers = function (audioData) {
            let sampleLength = 0;
            for (let i = 0; i < audioData.length; i++) {
                sampleLength += audioData[i].length;
            }
            let samples = new Float32Array(sampleLength);
            let sampleIdx = 0;
            for (let i = 0; i < audioData.length; i++) {
                for (let j = 0; j < audioData[i].length; j++) {
                    samples[sampleIdx] = audioData[i][j];
                    sampleIdx++;
                }
            }
            return samples;
        };

        //WavファイルをBlobファイルに変換する
        const convertIntoBlobfile = function (audioData) {
            let dataview = encodeWAV(mergeBuffers(audioData), voiceObject.audio_sample_rate); //11025以外の数字に設定すると"invalid sample-rate. is(22050.000000), expected(11025.000000)."というメッセージがAPIから帰ってくる
            let audioBlob = new Blob([dataview], { type: 'audio/wav' }); //Blob(データ,データタイプ)でBlobファイルを作成する
            console.log(audioBlob)
            return audioBlob
        };

        //BlobファイルをWebEmpathAPIのエンドポイントに送信するフォームデータに格納する。同時にAPIkeyも格納する。
        const storeBlobIntoAxios = function (API_KRY, BlobFile) {
            let axiosdata = new FormData(); //Axiosで送信する空のフォームデータ
            axiosdata.append('apikey', API_KRY); //APIkeyを格納する
            axiosdata.append('wav', BlobFile);
            return axiosdata
        };

        // 上述した２つの関数を実行し、axiosを使う準備をする
        //引数：BlobFile
        //戻り値：axiosdata   
        const readyAxios = function (audioData) {
            API_KEY = __VOICE_KEY
            BlobFile = convertIntoBlobfile(audioData)
            axiosReadyData = storeBlobIntoAxios(API_KEY, BlobFile)
            return axiosReadyData
        };

        //APIに送信した結果をオブジェクトで受け取る関数
        //引数：res(APIからの受信結果)
        //戻り値：emo_voice(音声感情分析の結果)
        const receiveAPI = function (res) {
            emo_voice = {
                anger: res.data["anger"] / 50,
                calm: res.data["calm"] / 50,
                energy: res.data["energy"] / 50,
                joy: res.data["joy"] / 50,
                sorrow: res.data["sorrow"] / 50
            }
            return emo_voice
        };
        //引数：audio DataとAPIのエンドポイントのURL
        //関数の中身：audio DataをAPIのエンドポイントに送信して結果を受け取る
        //戻値：なし
        const axiosdata = readyAxios(audioData)
        axios.post(__VOICE_URL, axiosdata, {
            headers: {
                'content-type': 'multipart/form-data',
            },
        }).then((res) => {
            //kranke.htmlの『このobj_voiceにapiから取得したデータを入れるようにしてください！』
            //で指示された通り、APIから取得したデータを代入
            //感情分析の結果を格納するオブジェクト
            //もっと分ける
            const Result = receiveAPI(res)
            console.log(Result)
            console.log(__DB.sendData('voice', Result))
            //他のAPIで返された値と揃えるために50で割る
        })
            .catch((response) => {
                console.log(response)
            });

    },
}

// save audio data
const onAudioProcess = function (e) {
    var input = e.inputBuffer.getChannelData(0);
    var bufferData = new Float32Array(voiceObject.bufferSize);
    for (var i = 0; i < voiceObject.bufferSize; i++) {
        bufferData[i] = input[i];
    }
    audioData.push(bufferData);
};

const recorder = function () {
    // when time passed without pushing the stop button
    setTimeout(function () {
        // console.log(audioData)
        voiceObject.voiceAnalysis(audioData);//APIに送る
        audioContext.close()
        // console.log(audioContext.state)
    }, voiceObject.recordTime);
};


// getusermedia
const handleSuccess = function (stream) {
    audioData = [];
    audioContext = new AudioContext();
    audio_sample_rate = audioContext.sampleRate;
    scriptProcessor = audioContext.createScriptProcessor(voiceObject.bufferSize, 1, 1);
    var mediastreamsource = audioContext.createMediaStreamSource(stream);
    mediastreamsource.connect(scriptProcessor);
    scriptProcessor.onaudioprocess = onAudioProcess;
    scriptProcessor.connect(audioContext.destination);
    console.log('record start?');
    recorder()
};
// getUserMedia
const startAnalysis = function () {
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(handleSuccess)
};

const sleepAnalysis = (ms) => new Promise(resolve => setTimeout(resolve, ms));

//5秒に1回録音する
window.__voice = {
    executeAnalysis: async function () {
        for (let recordCount = 0; recordCount < 4; recordCount++) {
            if (recordCount >= 1) {
                sleepId = await sleepAnalysis(5000)
                clearTimeout(sleepId)
            }
            startAnalysis()
        }
    }
}




// テスト用
// const startvoiceBtn = document.getElementById('face')
// startvoiceBtn.addEventListener("click", __voice.executeAnalysis)


//firebaseに送信
// let voice_flg;
// fb.ref(emo_flg).on('value', (d) => {
//     const v = d.val();
//     if (v == 1) {
//         stvoice();
//     }
// });
