var Recorder = function () {
    // window.AudioContext()
    window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;
    // navigator.getUserMedia()
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    // navigator.mediaDevices.getUserMedia()
    navigator.mediaDevices = navigator.mediaDevices || ((navigator.getUserMedia) ? {
        getUserMedia: function (c) {
            return new Promise(
                function (y, n) {
                    navigator.getUserMedia(c, y, n);
                }
            );
        }
    } : null);

    // public オブジェクト
    var recorder_ = {
        // public プロパティ
        version: "Recorder/1.0.02",
        downSampling: false,
        downSamplingElement: undefined,
        maxRecordingTime: 60000,
        maxRecordingTimeElement: undefined,
        // public メソッド
        resume: resume_,
        pause: pause_,
        isActive: isActive,
        // イベントハンドラ
        resumeStarted: undefined,
        resumeEnded: undefined,
        recorded: undefined,
        pauseStarted: undefined,
        pauseEnded: undefined,
        TRACE: undefined
    };

    // 録音関連
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    //  ┌────┐                                                      
    //  │0       │←───────────────────────┐┐┐
    //  └┬───┘                                                │││
    //    │resume()                                                │││
    //    │ - getUserMedia()                                       │││
    //    │                                                        │││
    //    ↓resumeStarted                                           │││
    //  ┌────┐                                                │││
    //  │1       │                                                │││
    //  └┬┬┬─┘                                                │││
    //    │││getUserMedia() 失敗                                 │││
    //    │││                                                    │││
    //    │││pauseEnded                                          │││
    //    ││└──────────────────────────┘││
    //    ││                                                        ││
    //    ││getUserMedia() 成功 && state_==3                        ││
    //    ││ - audioStream.getTracks().forEach(track=>track.stop()) ││
    //    ││                                                        ││
    //    ││pauseEnded                                              ││
    //    │└────────────────────────────┘│
    //    │                                                            │
    //    │getUserMedia() 成功 && state_==1                            │
    //    │ - audioProvider_=audioContext_.createMediaStreamSource     │
    //    │                                             (audioStream_) │
    //    │ - audioProvider_.connect(audioProcessor_)                  │
    //    │ - audioProcessor_.connect(audioContext_.destination)       │
    //    │                                                            │
    //    ↓resumeEnded                                                 │
    //  ┌────┐                                                    │
    //  │2 録音中│←────────────────────────┐│
    //  └┬┬──┘                                                  ││
    //    ││audioProcessor_.onaudioprocess                          ││
    //    │└────────────────────────────┘│
    //    │                                                            │
    //    │pause()                                                     │
    //    │                                                            │
    //    ↓pauseStarted                                                │
    //  ┌────┐                                                    │
    //  │3       │                                                    │
    //  └┬───┘                                                    │
    //    │audioProcessor_.onaudioprocess                              │
    //    │ - audioStream_.getTracks().forEach(track=>track.stop())    │
    //    │ - audioProvider_.disconnect()                              │
    //    │ - audioProcessor_.disconnect()                             │
    //    ↓                                                            │
    //  ┌────┐                                                    │
    //  │4       │                                                    │
    //  └┬───┘                                                    │
    //    │audioStream.oninactive                                      │
    //    │                                                            │
    //    │pauseStarted                                                │
    //    └──────────────────────────────┘
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    var state_ = -1;
    var audioContext_;
    var audioProcessor_;
    var audioProcessor_onaudioprocess_;
    var audioProcessor_onaudioprocess_recorded_;
    var audioProcessor_onaudioprocess_downSampling_;
    var audioProcessor_onaudioprocess_downSampling_recorded_;
    var audioStream_;
    var audioProvider_;
    var audioSamplesPerSec_;
    var audioDecimatationFactor_;
    var temporaryAudioData_;
    var temporaryAudioDataSamples_;
    var coefData_;
    var pcmData_;
    var waveData_;
    var waveDataBytes_;
    var waveFile_;
    var reason_;
    var maxRecordingTimeTimerId_;

    // 各種変数の初期化
    function initialize_() {
        // 録音関係の各種変数の初期化
        audioContext_ = new AudioContext();
        if (audioContext_.createScriptProcessor) {
            audioProcessor_ = audioContext_.createScriptProcessor(0, 1, 1);
        } else {
            audioProcessor_ = audioContext_.createJavaScriptNode(0, 1, 1);
        }
        audioProcessor_onaudioprocess_ = function (event) {
            var audioData = event.inputBuffer.getChannelData(0);
            var pcmData = new Uint8Array(audioData.length * 2);
            var pcmDataIndex = 0;
            for (var audioDataIndex = 0; audioDataIndex < audioData.length; audioDataIndex++) {
                var pcm = audioData[audioDataIndex] * 32768 | 0; // 小数 (0.0～1.0) を 整数 (-32768～32767) に変換...
                if (pcm > 32767) {
                    pcm = 32767;
                } else
                    if (pcm < -32768) {
                        pcm = -32768;
                    }
                pcmData[pcmDataIndex++] = (pcm) & 0xFF;
                pcmData[pcmDataIndex++] = (pcm >> 8) & 0xFF;
            }
            waveData_.push(pcmData.buffer);
            waveDataBytes_ += pcmData.buffer.byteLength;
            if (state_ === 3) {
                state_ = 4;
                audioStream_.stopTracks();
                audioStream_ = undefined;
                audioProvider_.disconnect();
                audioProvider_ = undefined;
                audioProcessor_.disconnect();
                if (recorder_.TRACE) recorder_.TRACE("INFO: stopped recording");
            }
        };
        audioProcessor_onaudioprocess_recorded_ = function (event) {
            var audioData = event.inputBuffer.getChannelData(0);
            var pcmDataIndex = 1;
            for (var audioDataIndex = 0; audioDataIndex < audioData.length; audioDataIndex++) {
                var pcm = audioData[audioDataIndex] * 32768 | 0; // 小数 (0.0～1.0) を 整数 (-32768～32767) に変換...
                if (pcm > 32767) {
                    pcm = 32767;
                } else
                    if (pcm < -32768) {
                        pcm = -32768;
                    }
                pcmData_[pcmDataIndex++] = (pcm >> 8) & 0xFF;
                pcmData_[pcmDataIndex++] = (pcm) & 0xFF;
            }
            if (recorder_.recorded) recorder_.recorded(pcmData_, 1, pcmDataIndex - 1);
            if (state_ === 3) {
                state_ = 4;
                audioStream_.stopTracks();
                audioStream_ = undefined;
                audioProvider_.disconnect();
                audioProvider_ = undefined;
                audioProcessor_.disconnect();
                if (recorder_.TRACE) recorder_.TRACE("INFO: stopped recording");
            }
        };
        audioProcessor_onaudioprocess_downSampling_ = function (event) {
            // <!-- for Safari
            if (state_ === 0) {
                return;
            }
            // -->
            var audioData = event.inputBuffer.getChannelData(0);
            var audioDataIndex = 0;
            while (temporaryAudioDataSamples_ < temporaryAudioData_.length) {
                temporaryAudioData_[temporaryAudioDataSamples_++] = audioData[audioDataIndex++];
            }
            while (temporaryAudioDataSamples_ == temporaryAudioData_.length) {
                var pcmData = new Uint8Array((audioData.length / audioDecimatationFactor_ | 0) * 2);
                var pcmDataIndex = 0;
                for (var temporaryAudioDataIndex = audioDecimatationFactor_ - 1; temporaryAudioDataIndex + 20 < temporaryAudioData_.length; temporaryAudioDataIndex += audioDecimatationFactor_) {
                    var pcm_float = 0.0;
                    for (var i = 0; i <= 20; i++) {
                        pcm_float += temporaryAudioData_[temporaryAudioDataIndex + i] * coefData_[i];
                    }
                    var pcm = pcm_float * 32768 | 0; // 小数 (0.0～1.0) を 整数 (-32768～32767) に変換...
                    if (pcm > 32767) {
                        pcm = 32767;
                    } else
                        if (pcm < -32768) {
                            pcm = -32768;
                        }
                    pcmData[pcmDataIndex++] = (pcm) & 0xFF;
                    pcmData[pcmDataIndex++] = (pcm >> 8) & 0xFF;
                }
                waveData_.push(pcmData.buffer);
                waveDataBytes_ += pcmData.buffer.byteLength;
                temporaryAudioDataSamples_ = 0;
                var temporaryAudioDataIndex = temporaryAudioData_.length - 20;
                while (temporaryAudioDataIndex < temporaryAudioData_.length) {
                    temporaryAudioData_[temporaryAudioDataSamples_++] = temporaryAudioData_[temporaryAudioDataIndex++];
                }
                while (audioDataIndex < audioData.length) {
                    temporaryAudioData_[temporaryAudioDataSamples_++] = audioData[audioDataIndex++];
                }
            }
            if (state_ === 3) {
                state_ = 4;
                audioStream_.stopTracks();
                audioStream_ = undefined;
                audioProvider_.disconnect();
                audioProvider_ = undefined;
                audioProcessor_.disconnect();
                if (recorder_.TRACE) recorder_.TRACE("INFO: stopped recording");
            }
        };
        audioProcessor_onaudioprocess_downSampling_recorded_ = function (event) {
            // <!-- for Safari
            if (state_ === 0) {
                return;
            }
            // -->
            var audioData = event.inputBuffer.getChannelData(0);
            var audioDataIndex = 0;
            while (temporaryAudioDataSamples_ < temporaryAudioData_.length) {
                temporaryAudioData_[temporaryAudioDataSamples_++] = audioData[audioDataIndex++];
            }
            while (temporaryAudioDataSamples_ == temporaryAudioData_.length) {
                var pcmDataIndex = 1;
                for (var temporaryAudioDataIndex = audioDecimatationFactor_ - 1; temporaryAudioDataIndex + 20 < temporaryAudioData_.length; temporaryAudioDataIndex += audioDecimatationFactor_) {
                    var pcm_float = 0.0;
                    for (var i = 0; i <= 20; i++) {
                        pcm_float += temporaryAudioData_[temporaryAudioDataIndex + i] * coefData_[i];
                    }
                    var pcm = pcm_float * 32768 | 0; // 小数 (0.0～1.0) を 整数 (-32768～32767) に変換...
                    if (pcm > 32767) {
                        pcm = 32767;
                    } else
                        if (pcm < -32768) {
                            pcm = -32768;
                        }
                    pcmData_[pcmDataIndex++] = (pcm >> 8) & 0xFF;
                    pcmData_[pcmDataIndex++] = (pcm) & 0xFF;
                }
                if (recorder_.recorded) recorder_.recorded(pcmData_, 1, pcmDataIndex - 1);
                temporaryAudioDataSamples_ = 0;
                var temporaryAudioDataIndex = temporaryAudioData_.length - 20;
                while (temporaryAudioDataIndex < temporaryAudioData_.length) {
                    temporaryAudioData_[temporaryAudioDataSamples_++] = temporaryAudioData_[temporaryAudioDataIndex++];
                }
                while (audioDataIndex < audioData.length) {
                    temporaryAudioData_[temporaryAudioDataSamples_++] = audioData[audioDataIndex++];
                }
            }
            if (state_ === 3) {
                state_ = 4;
                audioStream_.stopTracks();
                audioStream_ = undefined;
                audioProvider_.disconnect();
                audioProvider_ = undefined;
                audioProcessor_.disconnect();
                if (recorder_.TRACE) recorder_.TRACE("INFO: stopped recording");
            }
        };
        if (audioContext_.sampleRate === 48000) {
            audioSamplesPerSec_ = 16000;
            audioDecimatationFactor_ = 3;
        } else
            if (audioContext_.sampleRate === 44100) {
                audioSamplesPerSec_ = 22050;
                audioDecimatationFactor_ = 2;
            } else
                if (audioContext_.sampleRate === 22050) {
                    audioSamplesPerSec_ = 22050;
                    audioDecimatationFactor_ = 1;
                } else
                    if (audioContext_.sampleRate === 16000) {
                        audioSamplesPerSec_ = 16000;
                        audioDecimatationFactor_ = 1;
                    } else {
                        audioSamplesPerSec_ = 0;
                        audioDecimatationFactor_ = 0;
                    }
        if (audioDecimatationFactor_ > 1) {
            temporaryAudioData_ = new Float32Array(20 + (audioProcessor_.bufferSize / audioDecimatationFactor_ | 0) * audioDecimatationFactor_);
            temporaryAudioDataSamples_ = 0;
            coefData_ = new Float32Array(10 + 1 + 10);
            if (audioDecimatationFactor_ == 3) {
                coefData_[0] = -1.9186907e-2;
                coefData_[1] = 1.2144312e-2;
                coefData_[2] = 3.8677038e-2;
                coefData_[3] = 3.1580867e-2;
                coefData_[4] = -1.2342449e-2;
                coefData_[5] = -6.0144741e-2;
                coefData_[6] = -6.1757100e-2;
                coefData_[7] = 1.2462522e-2;
                coefData_[8] = 1.4362448e-1;
                coefData_[9] = 2.6923548e-1;
                coefData_[10] = 3.2090380e-1;
                coefData_[11] = 2.6923548e-1;
                coefData_[12] = 1.4362448e-1;
                coefData_[13] = 1.2462522e-2;
                coefData_[14] = -6.1757100e-2;
                coefData_[15] = -6.0144741e-2;
                coefData_[16] = -1.2342449e-2;
                coefData_[17] = 3.1580867e-2;
                coefData_[18] = 3.8677038e-2;
                coefData_[19] = 1.2144312e-2;
                coefData_[20] = -1.9186907e-2;
            } else {
                coefData_[0] = 6.91278819431317970157e-6;
                coefData_[1] = 3.50501872599124908447e-2;
                coefData_[2] = -6.93948777552577666938e-6;
                coefData_[3] = -4.52254377305507659912e-2;
                coefData_[4] = 6.96016786605468951166e-6;
                coefData_[5] = 6.34850487112998962402e-2;
                coefData_[6] = -6.97495897838962264359e-6;
                coefData_[7] = -1.05997055768966674805e-1;
                coefData_[8] = 6.98394205755903385580e-6;
                coefData_[9] = 3.18274468183517456055e-1;
                coefData_[10] = 4.99993026256561279297e-1;
                coefData_[11] = 3.18274468183517456055e-1;
                coefData_[12] = 6.98394205755903385580e-6;
                coefData_[13] = -1.05997055768966674805e-1;
                coefData_[14] = -6.97495897838962264359e-6;
                coefData_[15] = 6.34850487112998962402e-2;
                coefData_[16] = 6.96016786605468951166e-6;
                coefData_[17] = -4.52254377305507659912e-2;
                coefData_[18] = -6.93948777552577666938e-6;
                coefData_[19] = 3.50501872599124908447e-2;
                coefData_[20] = 6.91278819431317970157e-6;
            }
        }
        pcmData_ = new Uint8Array(1 + (audioProcessor_.bufferSize / audioDecimatationFactor_ | 0) * 2);
        reason_ = { code: 0, message: "" };
        maxRecordingTimeTimerId_ = null;
    }

    // 録音の開始
    function resume_() {
        if (state_ !== -1 && state_ !== 0) {
            if (recorder_.TRACE) recorder_.TRACE("ERROR: can't start recording (invalid state: " + state_ + ")");
            return false;
        }
        if (recorder_.resumeStarted) recorder_.resumeStarted();
        if (!window.AudioContext) {
            if (recorder_.TRACE) recorder_.TRACE("ERROR: can't start recording (Unsupported AudioContext class)");
            if (recorder_.pauseEnded) recorder_.pauseEnded({ code: 2, message: "Unsupported AudioContext class" }, waveFile_);
            return true;
        }
        if (!navigator.mediaDevices) {
            if (recorder_.TRACE) recorder_.TRACE("ERROR: can't start recording (Unsupported MediaDevices class)");
            if (recorder_.pauseEnded) recorder_.pauseEnded({ code: 2, message: "Unsupported MediaDevices class" }, waveFile_);
            return true;
        }
        if (state_ === -1) {
            // 各種変数の初期化
            initialize_();
            state_ = 0;
        }
        if (recorder_.downSamplingElement) recorder_.downSampling = recorder_.downSamplingElement.checked;
        if (recorder_.maxRecordingTimeElement) recorder_.maxRecordingTime = recorder_.maxRecordingTimeElement.value;
        if (recorder_.downSampling) {
            if (audioContext_.sampleRate === 48000) {
                audioSamplesPerSec_ = 16000;
                audioDecimatationFactor_ = 3;
            } else
                if (audioContext_.sampleRate === 44100) {
                    audioSamplesPerSec_ = 22050;
                    audioDecimatationFactor_ = 2;
                } else
                    if (audioContext_.sampleRate === 22050) {
                        audioSamplesPerSec_ = 22050;
                        audioDecimatationFactor_ = 1;
                    } else
                        if (audioContext_.sampleRate === 16000) {
                            audioSamplesPerSec_ = 16000;
                            audioDecimatationFactor_ = 1;
                        } else {
                            audioSamplesPerSec_ = 0;
                            audioDecimatationFactor_ = 0;
                        }
        } else {
            audioSamplesPerSec_ = audioContext_.sampleRate;
            audioDecimatationFactor_ = 1;
        }
        if (audioSamplesPerSec_ === 0) {
            if (recorder_.TRACE) recorder_.TRACE("ERROR: can't start recording (Unsupported sample rate: " + audioContext_.sampleRate + "Hz)");
            reason_.code = 2;
            reason_.message = "Unsupported sample rate: " + audioContext_.sampleRate + "Hz";
            if (recorder_.pauseEnded) recorder_.pauseEnded(reason_, waveFile_);
            return true;
        }
        state_ = 1;
        if (audioDecimatationFactor_ > 1) {
            for (var i = 0; i <= 20; i++) {
                temporaryAudioData_[i] = 0.0;
            }
            temporaryAudioDataSamples_ = 20;
        }
        if (!recorder_.recorded) {
            waveData_ = [];
            waveDataBytes_ = 0;
            waveData_.push(new ArrayBuffer(44));
            waveDataBytes_ += 44;
        }
        waveFile_ = null;
        reason_.code = 0;
        reason_.message = "";
        if (audioDecimatationFactor_ > 1) {
            if (recorder_.recorded) {
                audioProcessor_.onaudioprocess = audioProcessor_onaudioprocess_downSampling_recorded_;
            } else {
                audioProcessor_.onaudioprocess = audioProcessor_onaudioprocess_downSampling_;
            }
        } else {
            if (recorder_.recorded) {
                audioProcessor_.onaudioprocess = audioProcessor_onaudioprocess_recorded_;
            } else {
                audioProcessor_.onaudioprocess = audioProcessor_onaudioprocess_;
            }
        }
        navigator.mediaDevices.getUserMedia(
            { audio: true, video: false }
        ).then(
            function (audioStream) {
                audioStream.stopTracks = function () {
                    var tracks = audioStream.getTracks();
                    for (var i = 0; i < tracks.length; i++) {
                        tracks[i].stop();
                    }
                    state_ = 0;
                    if (waveData_) {
                        var waveData = new DataView(waveData_[0]);
                        waveData.setUint8(0, 0x52); // 'R'
                        waveData.setUint8(1, 0x49); // 'I'
                        waveData.setUint8(2, 0x46); // 'F'
                        waveData.setUint8(3, 0x46); // 'F'
                        waveData.setUint32(4, waveDataBytes_ - 8, true);
                        waveData.setUint8(8, 0x57); // 'W'
                        waveData.setUint8(9, 0x41); // 'A'
                        waveData.setUint8(10, 0x56); // 'V'
                        waveData.setUint8(11, 0x45); // 'E'
                        waveData.setUint8(12, 0x66); // 'f'
                        waveData.setUint8(13, 0x6D); // 'm'
                        waveData.setUint8(14, 0x74); // 't'
                        waveData.setUint8(15, 0x20); // ' '
                        waveData.setUint32(16, 16, true);
                        waveData.setUint16(20, 1, true); // formatTag
                        waveData.setUint16(22, 1, true); // channels
                        waveData.setUint32(24, audioSamplesPerSec_, true); // samplesPerSec
                        waveData.setUint32(28, audioSamplesPerSec_ * 2 * 1, true); // bytesPseSec
                        waveData.setUint16(32, 2 * 1, true); // bytesPerSample
                        waveData.setUint16(34, 16, true); // bitsPerSample
                        waveData.setUint8(36, 0x64); // 'd'
                        waveData.setUint8(37, 0x61); // 'a'
                        waveData.setUint8(38, 0x74); // 't'
                        waveData.setUint8(39, 0x61); // 'a'
                        waveData.setUint32(40, waveDataBytes_ - 44, true);
                        waveFile_ = new Blob(waveData_, { type: "audio/wav" });
                        waveFile_.samplesPerSec = audioSamplesPerSec_;
                        waveFile_.samples = (waveDataBytes_ - 44) / (2 * 1);
                        waveData_ = null;
                        waveDataBytes_ = 0;
                    }
                    if (recorder_.pauseEnded) recorder_.pauseEnded(reason_, waveFile_);
                };
                if (state_ === 3) {
                    state_ = 4;
                    audioStream.stopTracks();
                    if (audioDecimatationFactor_ > 1) {
                        if (recorder_.TRACE) recorder_.TRACE("INFO: cancelled recording: " + audioContext_.sampleRate + "Hz -> " + audioSamplesPerSec_ + "Hz (" + audioProcessor_.bufferSize + " samples/buffer)");
                    } else {
                        if (recorder_.TRACE) recorder_.TRACE("INFO: cancelled recording: " + audioSamplesPerSec_ + "Hz (" + audioProcessor_.bufferSize + " samples/buffer)");
                    }
                    return;
                }
                state_ = 2;
                audioStream_ = audioStream;
                audioProvider_ = audioContext_.createMediaStreamSource(audioStream_);
                audioProvider_.connect(audioProcessor_);
                audioProcessor_.connect(audioContext_.destination);
                if (audioDecimatationFactor_ > 1) {
                    if (recorder_.TRACE) recorder_.TRACE("INFO: started recording: " + audioContext_.sampleRate + "Hz -> " + audioSamplesPerSec_ + "Hz (" + audioProcessor_.bufferSize + " samples/buffer)");
                } else {
                    if (recorder_.TRACE) recorder_.TRACE("INFO: started recording: " + audioSamplesPerSec_ + "Hz (" + audioProcessor_.bufferSize + " samples/buffer)");
                }
                startMaxRecordingTimeTimer_();
                if (recorder_.resumeEnded) recorder_.resumeEnded(audioSamplesPerSec_);
            }
        ).catch(
            function (error) {
                state_ = 0;
                if (recorder_.TRACE) recorder_.TRACE("ERROR: can't start recording (" + error.message + ")");
                reason_.code = 2;
                reason_.message = error.message;
                if (recorder_.pauseEnded) recorder_.pauseEnded(reason_, waveFile_);
            }
        );
        return true;
    }

    // 録音の停止
    function pause_() {
        if (state_ !== 2) {
            if (recorder_.TRACE) recorder_.TRACE("ERROR: can't stop recording (invalid state: " + state_ + ")");
            return false;
        }
        state_ = 3;
        if (recorder_.pauseStarted) recorder_.pauseStarted();
        stopMaxRecordingTimeTimer_();
        return true;
    }

    // 録音中かどうかの取得
    function isActive() {
        return (state_ === 2);
    }

    // 録音の停止を自動的に行うためのタイマの開始
    function startMaxRecordingTimeTimer_() {
        if (recorder_.maxRecordingTime <= 0) {
            return;
        }
        stopMaxRecordingTimeTimer_();
        maxRecordingTimeTimerId_ = setTimeout(fireMaxRecordingTimeTimer_, recorder_.maxRecordingTime);
        if (recorder_.TRACE) recorder_.TRACE("INFO: started auto pause timeout timer: " + recorder_.maxRecordingTime);
    }

    // 録音の停止を自動的に行うためのタイマの停止
    function stopMaxRecordingTimeTimer_() {
        if (maxRecordingTimeTimerId_ !== null) {
            clearTimeout(maxRecordingTimeTimerId_);
            maxRecordingTimeTimerId_ = null;
            if (recorder_.TRACE) recorder_.TRACE("INFO: stopped auto pause timeout timer: " + recorder_.maxRecordingTime);
        }
    }

    // 録音の停止を自動的に行うためのタイマの発火
    function fireMaxRecordingTimeTimer_() {
        if (recorder_.TRACE) recorder_.TRACE("INFO: fired auto pause timeout timer: " + recorder_.maxRecordingTime);
        reason_.code = 1;
        reason_.message = "Exceeded max recording time";
        // pause_();
    }

    // public オブジェクトの返却
    return recorder_;
}();

var Wrp = function () {
    // public オブジェクト
    var wrp_ = {
        // public プロパティ
        version: "Wrp/1.0.02",
        serverURL: "",
        serverURLElement: undefined,
        grammarFileNames: "",
        grammarFileNamesElement: undefined,
        mode: "",
        modeElement: undefined,
        profileId: "",
        profileIdElement: undefined,
        profileWords: "",
        profileWordsElement: undefined,
        segmenterType: "",
        segmenterTypeElement: undefined,
        segmenterProperties: "",
        segmenterPropertiesElement: undefined,
        resultUpdatedInterval: "",
        resultUpdatedIntervalElement: undefined,
        extension: "",
        extensionElement: undefined,
        authorization: "",
        authorizationElement: undefined,
        codec: "",
        codecElement: undefined,
        resultType: "",
        resultTypeElement: undefined,
        checkIntervalTime: 0,
        checkIntervalTimeElement: undefined,
        issuerURL: "",
        issuerURLElement: undefined,
        sid: null,
        sidElement: undefined,
        spw: null,
        spwElement: undefined,
        epi: null,
        epiElement: undefined,
        // public メソッド
        connect: connect_,
        disconnect: disconnect_,
        feedDataResume: feedDataResume_,
        feedData: feedData_,
        feedDataPause: feedDataPause_,
        isConnected: isConnected_,
        isActive: isActive_,
        issue: issue_,
        // イベントハンドラ
        connectStarted: undefined,
        connectEnded: undefined,
        disconnectStarted: undefined,
        disconnectEnded: undefined,
        feedDataResumeStarted: undefined,
        feedDataResumeEnded: undefined,
        feedDataPauseStarted: undefined,
        feedDataPauseEnded: undefined,
        utteranceStarted: undefined,
        utteranceEnded: undefined,
        resultCreated: undefined,
        resultUpdated: undefined,
        resultFinalized: undefined,
        issueStarted: undefined,
        issueEnded: undefined,
        TRACE: undefined
    };

    // 通信関連
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    //  ┌───────────────────────────────┐
    //  │0(disconnected)                                               │
    //  └────────┬──────────────────────┘
    //           connect()↓↑onclose   ↑onclose     ↑onclose           
    //  ┌─────────┴──┐    │    ┌───┴────────┐
    //  │1(connecting)           │    │    │8(disconnecting)        │
    //  └────────┬───┘    │    └────────────┘
    //              onopen│            │          ↑↑                  
    //                    ↓            │       ※1││disconnect()      
    //  ┌───────────────┴─────┴┴────────┐
    //  │2(connected)                                                  │
    //  └────────┬──────────────────────┘
    //    feedDataResume()│↑                        ↑                  
    //            resume()↓│pauseEnded              │pauseEnded        
    //  ┌─────────┴──┐          ┌───┴────────┐
    //  │3(waiting resumeEnded)  │    ┌─→│7(waiting pauseEnded)   │
    //  └────────┬───┘    │    └────────────┘
    //         resumeEnded│┌─────┘            ↑                  
    //                 's'││pause()                 │pause()           
    //                    ↓│'s' error response      │'e' response      
    //  ┌─────────┴──┐          ┌───┴────────┐
    //  │4(waiting 's' response) │          │6(waiting 'e' response) │
    //  └────────┬───┘          └────────────┘
    //        's' response│                          ↑'e'               
    //                    ↓                          │feedDataPause()   
    //  ┌──────────────────────┴────────┐
    //  │5(resumed)                                                    │
    //  └────────┬──────────────────────┘
    //          feedData()│                          ↑                  
    //                 'p'└─────────────┘                  
    //                                    ※1 error response・disconnect()
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    //  ┌───────────────────────────────┐
    //  │0(disconnected)                                               │
    //  └───────────────────────────────┘
    //    ↑pauseEnded                          ↑pauseEnded              
    //  ┌┴─────────┐              ┌┴───────────┐
    //  │13                  ├──────→│17                      │
    //  └──────────┘resumeEnded   └────────────┘
    //    ↑                    pause()      pause()↑         onclose↑  
    //    │onclose                          onclose├──┬──┐    │  
    //  ┌┴┐                                    ┌┴┐┌┴┐┌┴┐┌┴┐
    //  │3 │                                    │4 ││5 ││6 ││7 │
    //  └─┘                                    └─┘└─┘└─┘└─┘
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    //  ┌───────────────────────────────┐
    //  │8(disconnecting)                                              │
    //  └───────────────────────────────┘
    //    ↑                    ┌─┐          ↑                  ┌─┐
    //    │                ┌→│13│          │              ┌→│17│
    //    │disconnect()    │  └─┘          │disconnect()  │  └─┘
    //    │pauseEnded      │onclose           │pauseEnded    │onclose 
    //  ┌┴────────┴┐              ┌┴───────┴───┐
    //  │23                  ├──────→│27                      │
    //  └──────────┘resumeEnded   └────────────┘
    //    ↑                    pause()      pause()↑  error response↑  
    //    │error resopnse            error response├──┬──┐    │  
    //  ┌┴┐                                    ┌┴┐┌┴┐┌┴┐┌┴┐
    //  │3 │                                    │4 ││5 ││6 ││7 │
    //  └─┘                                    └─┘└─┘└─┘└─┘
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    //  ┌───────────────────────────────┐
    //  │0(disconnected)                                               │
    //  └───────────────────────────────┘
    //    ↑                                    ↑    ┌────────┐
    //    │                                    │┌→│2(connected)    │
    //    │                                    ││  └────────┘
    //    │                    ┌─┐          ││'e' response    ┌─┐
    //    │                ┌→│ 8│          ││            ┌→│ 8│
    //    │                │  └─┘          ││            │  └─┘
    //    │onclose         │※1        onclose││            │※1     
    //  ┌┴────────┴┐              ┌┴┴──────┴───┐
    //  │34                  ├──────→│36                      │
    //  └──────────┘'s' response  └────────────┘
    //    ↑                    'e'              'e'↑                ↑  
    //    │pauseEnded                    pauseEnded│      pauseEnded│  
    //  ┌┴┐                                    ┌┴┐            ┌┴┐
    //  │4 │                                    │5 │            │6 │
    //  └─┘                                    └─┘            └─┘
    //                                    ※1 error response・disconnect()
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    var state_ = 0;
    var socket_;
    var reason_;
    var checkIntervalTimeoutTimerId_ = null;
    var interlock_ = false;
    var recorder_ = window.Recorder || null;

    if (recorder_) {
        // 録音ライブラリのプロパティの設定
        recorder_.downSampling = true;

        // 録音の開始処理が完了した時に呼び出されます。
        recorder_.resumeEnded = function (samplesPerSec) {
            wrp_.codec = "MSB" + (samplesPerSec / 1000 | 0) + "K";
            if (wrp_.codecElement) wrp_.codecElement.value = wrp_.codec;
            if (state_ == 0) {
                connect_();
            } else
                if (state_ === 3) {
                    state_ = 4;
                    feedDataResume__();
                } else
                    if (state_ === 13) {
                        state_ = 17;
                        recorder_.pause();
                    } else
                        if (state_ === 23) {
                            state_ = 27;
                            recorder_.pause();
                        }
        };

        // 録音の開始処理が失敗した時または録音の停止処理が完了した時に呼び出されます。
        recorder_.pauseEnded = function (reason) {
            if (state_ == 0) {
                if (wrp_.feedDataResumeStarted) wrp_.feedDataResumeStarted();
                if (wrp_.feedDataPauseEnded) wrp_.feedDataPauseEnded(reason);
            } else
                if (state_ === 3) {
                    state_ = 2;
                    if (wrp_.feedDataPauseEnded) wrp_.feedDataPauseEnded(reason);
                    if (interlock_) {
                        disconnect_();
                    }
                } else
                    if (state_ === 4) {
                        state_ = 34;
                        reason_ = reason;
                    } else
                        if (state_ === 5) {
                            state_ = 36;
                            reason_ = reason;
                            feedDataPause__();
                        } else
                            if (state_ === 6) {
                                state_ = 36;
                                reason_ = reason;
                            } else
                                if (state_ === 7) {
                                    state_ = 2;
                                    if (wrp_.feedDataPauseEnded) wrp_.feedDataPauseEnded(reason);
                                    if (interlock_) {
                                        disconnect_();
                                    }
                                } else
                                    if (state_ === 13 || state_ === 17) {
                                        state_ = 0;
                                        if (wrp_.feedDataPauseEnded) wrp_.feedDataPauseEnded(reason_);
                                        if (wrp_.disconnectEnded) wrp_.disconnectEnded();
                                        interlock_ = false;
                                    } else
                                        if (state_ === 23 || state_ === 27) {
                                            state_ = 8;
                                            if (wrp_.feedDataPauseEnded) wrp_.feedDataPauseEnded(reason_);
                                            if (wrp_.disconnectStarted) wrp_.disconnectStarted();
                                            socket_.close();
                                        }
        };

        // 音声データが録音された時に呼び出されます。
        recorder_.recorded = function (data, offset, length) {
            if (state_ === 5) {
                feedData__(data, offset, length);
            }
        };
    }

    // WebSocket のオープン
    function connect_() {
        if (state_ !== 0) {
            if (wrp_.TRACE) wrp_.TRACE("ERROR: can't connect to WebSocket server (Invalid state: " + state_ + ")");
            return false;
        }
        if (wrp_.connectStarted) wrp_.connectStarted();
        if (!window.WebSocket) {
            if (wrp_.TRACE) wrp_.TRACE("ERROR: can't start feeding data to HTTP server (Unsupported WebSocket class)");
            if (wrp_.disconnectEnded) wrp_.disconnectEnded();
            return true;
        }
        if (wrp_.serverURLElement) wrp_.serverURL = wrp_.serverURLElement.value;
        if (!wrp_.serverURL) {
            if (wrp_.TRACE) wrp_.TRACE("ERROR: can't connect to WebSocket server (Missing server URL)");
            if (wrp_.disconnectEnded) wrp_.disconnectEnded();
            return true;
        }
        try {
            socket_ = new WebSocket(wrp_.serverURL);
        } catch (e) {
            if (wrp_.TRACE) wrp_.TRACE("ERROR: can't connect to WebSocket server (" + e.message + ")");
            if (wrp_.disconnectEnded) wrp_.disconnectEnded();
            return true;
        }
        state_ = 1;
        socket_.onopen = function (event) {
            state_ = 2;
            if (wrp_.TRACE) wrp_.TRACE("INFO: connected to WebSocket server: " + wrp_.serverURL);
            if (wrp_.connectEnded) wrp_.connectEnded();
            if (interlock_) {
                feedDataResume_();
            }
        };
        socket_.onclose = function (event) {
            if (state_ === 1) {
                state_ = 0;
                if (wrp_.TRACE) wrp_.TRACE("ERROR: can't connect to WebSocket server: " + wrp_.serverURL);
                if (wrp_.disconnectEnded) wrp_.disconnectEnded();
                interlock_ = false;
            } else
                if (state_ === 2) {
                    state_ = 0;
                    if (wrp_.disconnectStarted) wrp_.disconnectStarted();
                    if (wrp_.TRACE) wrp_.TRACE("ERROR: disconnected from WebSocket server");
                    if (wrp_.disconnectEnded) wrp_.disconnectEnded();
                    interlock_ = false;
                } else
                    if (state_ === 3) {
                        state_ = 13;
                        if (wrp_.disconnectStarted) wrp_.disconnectStarted();
                        if (wrp_.TRACE) wrp_.TRACE("ERROR: disconnected from WebSocket server");
                        if (!reason_) {
                            reason_ = { code: 3, message: "Disconnected from WebSocket server" };
                        }
                    } else
                        if (state_ === 4 || state_ === 5 || state_ === 6) {
                            if (state_ != 6) {
                                if (wrp_.feedDataPauseStarted) wrp_.feedDataPauseStarted();
                            }
                            state_ = 17;
                            if (wrp_.disconnectStarted) wrp_.disconnectStarted();
                            if (wrp_.TRACE) wrp_.TRACE("ERROR: disconnected from WebSocket server");
                            if (!reason_) {
                                reason_ = { code: 3, message: "Disconnected from WebSocket server" };
                            }
                            if (recorder_) {
                                recorder_.pause();
                            } else {
                                state_ = 0;
                                if (wrp_.feedDataPauseEnded) wrp_.feedDataPauseEnded(reason_);
                                if (wrp_.disconnectEnded) wrp_.disconnectEnded();
                            }
                        } else
                            if (state_ === 7) {
                                state_ = 17;
                                if (wrp_.disconnectStarted) wrp_.disconnectStarted();
                                if (wrp_.TRACE) wrp_.TRACE("ERROR: disconnected from WebSocket server");
                                if (!reason_) {
                                    reason_ = { code: 3, message: "Disconnected from WebSocket server" };
                                }
                            } else
                                if (state_ === 8) {
                                    state_ = 0;
                                    if (wrp_.TRACE) wrp_.TRACE("INFO: disconnected from WebSocket server");
                                    if (wrp_.disconnectEnded) wrp_.disconnectEnded();
                                    interlock_ = false;
                                } else
                                    if (state_ === 23) {
                                        state_ = 13;
                                        if (wrp_.disconnectStarted) wrp_.disconnectStarted();
                                        if (wrp_.TRACE) wrp_.TRACE("ERROR: disconnected from WebSocket server");
                                    } else
                                        if (state_ === 27) {
                                            state_ = 17;
                                            if (wrp_.disconnectStarted) wrp_.disconnectStarted();
                                            if (wrp_.TRACE) wrp_.TRACE("ERROR: disconnected from WebSocket server");
                                        } else
                                            if (state_ === 34 || state_ === 36) {
                                                state_ = 0;
                                                if (wrp_.feedDataPauseEnded) wrp_.feedDataPauseEnded(reason_);
                                                if (wrp_.disconnectStarted) wrp_.disconnectStarted();
                                                if (wrp_.TRACE) wrp_.TRACE("ERROR: disconnected from WebSocket server");
                                                if (wrp_.disconnectEnded) wrp_.disconnectEnded();
                                                interlock_ = false;
                                            }
        };
        socket_.onmessage = function (event) {
            if (wrp_.TRACE) wrp_.TRACE("-> " + event.data);
            var tag = event.data[0];
            var body = event.data.substring(2);
            if (tag === 's') {
                if (body) {
                    if (state_ === 2) {
                        state_ = 8;
                        stopCheckIntervalTimeoutTimer_();
                        if (wrp_.TRACE) wrp_.TRACE("ERROR: can't start feeding data to WebSocket server (" + body + ")");
                        if (wrp_.disconnectStarted) wrp_.disconnectStarted();
                        socket_.close();
                    } else
                        if (state_ === 3) {
                            state_ = 23;
                            stopCheckIntervalTimeoutTimer_();
                            if (wrp_.TRACE) wrp_.TRACE("ERROR: can't start feeding data to WebSocket server (" + body + ")");
                            reason_ = { code: 3, message: body };
                        } else
                            if (state_ === 4) {
                                state_ = 7;
                                stopCheckIntervalTimeoutTimer_();
                                if (wrp_.TRACE) wrp_.TRACE("ERROR: can't start feeding data to WebSocket server (" + body + ")");
                                reason_ = { code: 3, message: body };
                                if (recorder_) {
                                    recorder_.pause();
                                } else {
                                    state_ = 2;
                                    if (wrp_.feedDataPauseEnded) wrp_.feedDataPauseEnded(reason_);
                                }
                            } else
                                if (state_ === 5 || state_ === 6) {
                                    if (state_ != 6) {
                                        if (wrp_.feedDataPauseStarted) wrp_.feedDataPauseStarted();
                                    }
                                    state_ = 27;
                                    stopCheckIntervalTimeoutTimer_();
                                    if (wrp_.TRACE) wrp_.TRACE("ERROR: can't start feeding data to WebSocket server (" + body + ")");
                                    reason_ = { code: 3, message: body };
                                    if (recorder_) {
                                        recorder_.pause();
                                    } else {
                                        state_ = 8;
                                        if (wrp_.feedDataPauseEnded) wrp_.feedDataPauseEnded(reason_);
                                        if (wrp_.disconnectStarted) wrp_.disconnectStarted();
                                        socket_.close();
                                    }
                                } else
                                    if (state_ === 7) {
                                        state_ = 27;
                                        stopCheckIntervalTimeoutTimer_();
                                        if (wrp_.TRACE) wrp_.TRACE("ERROR: can't start feeding data to WebSocket server (" + body + ")");
                                        reason_ = { code: 3, message: body };
                                    } else
                                        if (state_ === 34 || state_ === 36) {
                                            state_ = 8;
                                            stopCheckIntervalTimeoutTimer_();
                                            if (wrp_.TRACE) wrp_.TRACE("ERROR: can't start feeding data to WebSocket server (" + body + ")");
                                            if (wrp_.feedDataPauseEnded) wrp_.feedDataPauseEnded(reason_);
                                            if (wrp_.disconnectStarted) wrp_.disconnectStarted();
                                            socket_.close();
                                        }
                } else {
                    if (state_ === 4) {
                        state_ = 5;
                        if (wrp_.TRACE) wrp_.TRACE("INFO: started feeding data to WebSocket server");
                        startCheckIntervalTimeoutTimer_();
                        if (wrp_.feedDataResumeEnded) wrp_.feedDataResumeEnded();
                    } else
                        if (state_ === 34) {
                            state_ = 36;
                            if (wrp_.TRACE) wrp_.TRACE("INFO: started feeding data to WebSocket server");
                            feedDataPause__();
                        }
                }
            } else
                if (tag === 'p') {
                    if (body) {
                        if (state_ === 2) {
                            state_ = 8;
                            stopCheckIntervalTimeoutTimer_();
                            if (wrp_.TRACE) wrp_.TRACE("ERROR: can't feed data to WebSocket server (" + body + ")");
                            if (wrp_.disconnectStarted) wrp_.disconnectStarted();
                            socket_.close();
                        } else
                            if (state_ === 3) {
                                state_ = 23;
                                stopCheckIntervalTimeoutTimer_();
                                if (wrp_.TRACE) wrp_.TRACE("ERROR: can't feed data to WebSocket server (" + body + ")");
                                reason_ = { code: 3, message: body };
                            } else
                                if (state_ === 4 || state_ === 5 || state_ === 6) {
                                    if (state_ != 6) {
                                        if (wrp_.feedDataPauseStarted) wrp_.feedDataPauseStarted();
                                    }
                                    state_ = 27;
                                    stopCheckIntervalTimeoutTimer_();
                                    if (wrp_.TRACE) wrp_.TRACE("ERROR: can't feed data to WebSocket server (" + body + ")");
                                    reason_ = { code: 3, message: body };
                                    if (recorder_) {
                                        recorder_.pause();
                                    } else {
                                        state_ = 8;
                                        if (wrp_.feedDataPauseEnded) wrp_.feedDataPauseEnded(reason_);
                                        if (wrp_.disconnectStarted) wrp_.disconnectStarted();
                                        socket_.close();
                                    }
                                } else
                                    if (state_ === 7) {
                                        state_ = 27;
                                        stopCheckIntervalTimeoutTimer_();
                                        if (wrp_.TRACE) wrp_.TRACE("ERROR: can't feed data to WebSocket server (" + body + ")");
                                        reason_ = { code: 3, message: body };
                                    } else
                                        if (state_ === 34 || state_ === 36) {
                                            state_ = 8;
                                            stopCheckIntervalTimeoutTimer_();
                                            if (wrp_.TRACE) wrp_.TRACE("ERROR: can't feed data to WebSocket server (" + body + ")");
                                            if (wrp_.feedDataPauseEnded) wrp_.feedDataPauseEnded(reason_);
                                            if (wrp_.disconnectStarted) wrp_.disconnectStarted();
                                            socket_.close();
                                        }
                    }
                } else
                    if (tag === 'e') {
                        if (body) {
                            if (state_ === 2) {
                                state_ = 8;
                                stopCheckIntervalTimeoutTimer_();
                                if (wrp_.TRACE) wrp_.TRACE("ERROR: can't stop feeding data to WebSocket server (" + body + ")");
                                if (wrp_.disconnectStarted) wrp_.disconnectStarted();
                                socket_.close();
                            } else
                                if (state_ === 3) {
                                    state_ = 23;
                                    stopCheckIntervalTimeoutTimer_();
                                    if (wrp_.TRACE) wrp_.TRACE("ERROR: can't stop feeding data to WebSocket server (" + body + ")");
                                    reason_ = { code: 3, message: body };
                                } else
                                    if (state_ === 4 || state_ === 5 || state_ === 6) {
                                        if (state_ != 6) {
                                            if (wrp_.feedDataPauseStarted) wrp_.feedDataPauseStarted();
                                        }
                                        state_ = 27;
                                        stopCheckIntervalTimeoutTimer_();
                                        if (wrp_.TRACE) wrp_.TRACE("ERROR: can't stop feeding data to WebSocket server (" + body + ")");
                                        reason_ = { code: 3, message: body };
                                        if (recorder_) {
                                            recorder_.pause();
                                        } else {
                                            state_ = 8;
                                            if (wrp_.feedDataPauseEnded) wrp_.feedDataPauseEnded(reason_);
                                            if (wrp_.disconnectStarted) wrp_.disconnectStarted();
                                            socket_.close();
                                        }
                                    } else
                                        if (state_ === 7) {
                                            state_ = 27;
                                            stopCheckIntervalTimeoutTimer_();
                                            if (wrp_.TRACE) wrp_.TRACE("ERROR: can't stop feeding data to WebSocket server (" + body + ")");
                                            reason_ = { code: 3, message: body };
                                        } else
                                            if (state_ === 34 || state_ === 36) {
                                                state_ = 8;
                                                stopCheckIntervalTimeoutTimer_();
                                                if (wrp_.TRACE) wrp_.TRACE("ERROR: can't stop feeding data to WebSocket server (" + body + ")");
                                                if (wrp_.feedDataPauseEnded) wrp_.feedDataPauseEnded(reason_);
                                                if (wrp_.disconnectStarted) wrp_.disconnectStarted();
                                                socket_.close();
                                            }
                        } else {
                            if (state_ === 6) {
                                state_ = 7;
                                stopCheckIntervalTimeoutTimer_();
                                if (wrp_.TRACE) wrp_.TRACE("INFO: stopped feeding data to WebSocket server");
                                if (recorder_) {
                                    recorder_.pause();
                                } else {
                                    state_ = 2;
                                    if (wrp_.feedDataPauseEnded) wrp_.feedDataPauseEnded({ code: 0, message: "" });
                                }
                            } else
                                if (state_ === 36) {
                                    state_ = 2;
                                    stopCheckIntervalTimeoutTimer_();
                                    if (wrp_.TRACE) wrp_.TRACE("INFO: stopped feeding data to WebSocket server");
                                    if (wrp_.feedDataPauseEnded) wrp_.feedDataPauseEnded(reason_);
                                    if (interlock_) {
                                        disconnect_();
                                    }
                                }
                        }
                    } else
                        if (tag === 'S') {
                            if (wrp_.utteranceStarted) wrp_.utteranceStarted(body);
                            stopCheckIntervalTimeoutTimer_();
                        } else
                            if (tag === 'E') {
                                if (wrp_.utteranceEnded) wrp_.utteranceEnded(body);
                            } else
                                if (tag === 'C') {
                                    if (wrp_.resultCreated) wrp_.resultCreated();
                                } else
                                    if (tag === 'U') {
                                        if (wrp_.resultUpdated) wrp_.resultUpdated(body);
                                    } else
                                        if (tag === 'A') {
                                            if (wrp_.resultFinalized) wrp_.resultFinalized(body);
                                            startCheckIntervalTimeoutTimer_();
                                        } else
                                            if (tag === 'R') {
                                                if (wrp_.resultFinalized) wrp_.resultFinalized("\x01\x01\x01\x01\x01" + body);
                                                startCheckIntervalTimeoutTimer_();
                                            }
        };
        reason_ = null;
        return true;
    }

    // WebSocket のクローズ
    function disconnect_() {
        if (state_ === 5) {
            interlock_ = true;
            if (recorder_) {
                recorder_.TRACE = wrp_.TRACE;
            }
            return feedDataPause_();
        }
        if (state_ !== 2) {
            if (wrp_.TRACE) wrp_.TRACE("ERROR: can't disconnect from WebSocket server (Invalid state: " + state_ + ")");
            return false;
        }
        if (wrp_.disconnectStarted) wrp_.disconnectStarted();
        state_ = 8;
        socket_.close();
        return true;
    }

    // 音声データの供給の開始
    function feedDataResume_() {
        if (state_ === 0) {
            interlock_ = true;
            if (recorder_) {
                recorder_.TRACE = wrp_.TRACE;
            }
            // <!-- for Safari
            if (recorder_ && !recorder_.isActive()) {
                recorder_.resume();
                return true;
            }
            // -->
            return connect_();
        }
        if (state_ !== 2) {
            if (wrp_.TRACE) wrp_.TRACE("ERROR: can't start feeding data to WebSocket server (Invalid state: " + state_ + ")");
            return false;
        }
        if (wrp_.feedDataResumeStarted) wrp_.feedDataResumeStarted();
        state_ = 3;
        if (recorder_ && !recorder_.isActive()) {
            recorder_.resume();
            return true;
        }
        state_ = 4;
        feedDataResume__();
        return true;
    }
    function feedDataResume__(samplesPerSec) {
        if (wrp_.grammarFileNamesElement) wrp_.grammarFileNames = wrp_.grammarFileNamesElement.value;
        if (wrp_.modeElement) wrp_.mode = wrp_.modeElement.value;
        if (wrp_.profileIdElement) wrp_.profileId = wrp_.profileIdElement.value;
        if (wrp_.profileWordsElement) wrp_.profileWords = wrp_.profileWordsElement.value;
        if (wrp_.segmenterTypeElement) wrp_.segmenterType = wrp_.segmenterTypeElement.value;
        if (wrp_.segmenterPropertiesElement) wrp_.segmenterProperties = wrp_.segmenterPropertiesElement.value;
        if (wrp_.resultUpdatedIntervalElement) wrp_.resultUpdatedInterval = wrp_.resultUpdatedIntervalElement.value;
        if (wrp_.extensionElement) wrp_.extension = wrp_.extensionElement.value;
        if (wrp_.authorizationElement) wrp_.authorization = wrp_.authorizationElement.value;
        if (wrp_.codecElement) wrp_.codec = wrp_.codecElement.value;
        if (wrp_.resultTypeElement) wrp_.resultType = wrp_.resultTypeElement.value;
        if (wrp_.checkIntervalTimeElement) wrp_.checkIntervalTime = wrp_.checkIntervalTimeElement.value;
        if (samplesPerSec) {
            wrp_.codec = "MSB" + (samplesPerSec / 1000 | 0) + "K";
            if (wrp_.codecElement) wrp_.codecElement.value = wrp_.codec;
        }
        var command = "s ";
        if (wrp_.codec) {
            command += wrp_.codec;
        } else {
            command += "MSB16K";
        }
        if (wrp_.grammarFileNames) {
            command += " " + wrp_.grammarFileNames;
            if (wrp_.grammarFileNames.indexOf('\x01') != -1 && !wrp_.grammarFileNames.endsWith("\x01")) {
                command += '\x01';
            }
        } else {
            command += " \x01";
        }
        if (wrp_.mode) {
            command += " mode=" + wrp_.mode;
        }
        if (wrp_.profileId) {
            command += " profileId=" + wrp_.profileId;
        }
        if (wrp_.profileWords) {
            command += " profileWords=\"" + wrp_.profileWords.replace(/"/g, "\"\"") + "\"";
        }
        if (wrp_.segmenterType) {
            command += " segmenterType=" + wrp_.segmenterType;
        }
        if (wrp_.segmenterProperties) {
            command += " segmenterProperties=\"" + wrp_.segmenterProperties.replace(/"/g, "\"\"") + "\"";
        }
        if (wrp_.resultUpdatedInterval) {
            command += " resultUpdatedInterval=" + wrp_.resultUpdatedInterval;
        }
        if (wrp_.extension) {
            command += " extension=\"" + wrp_.extension.replace(/"/g, "\"\"") + "\"";
        }
        if (wrp_.authorization) {
            command += " authorization=" + wrp_.authorization;
        }
        if (wrp_.resultType) {
            command += " resultType=" + wrp_.resultType;
        }
        socket_.send(command);
        if (wrp_.TRACE) wrp_.TRACE("<- " + command);
        return true;
    }

    // 音声データの供給
    function feedData_(data, offset, length) {
        if (state_ !== 5) {
            if (wrp_.TRACE) wrp_.TRACE("ERROR: can't feed data to WebSocket server (Invalid state: " + state_ + ")");
            return false;
        }
        feedData__(data, offset, length);
        return true;
    }
    function feedData__(data, offset, length) {
        if (offset === 1 && data.length === length + 1) {
            data[0] = 0x70; // 'p'
            socket_.send(data);
        } else {
            var outData = new Uint8Array(length + 1);
            outData[0] = 0x70; // 'p'
            for (var i = 0; i < length; i++) {
                outData[1 + i] = data[offset + i];
            }
            socket_.send(outData);
        }
    }

    // 音声データの供給の停止
    function feedDataPause_() {
        if (state_ !== 5) {
            if (wrp_.TRACE) wrp_.TRACE("ERROR: can't stop feeding data to WebSocket server (Invalid state: " + state_ + ")");
            return false;
        }
        if (wrp_.feedDataPauseStarted) wrp_.feedDataPauseStarted();
        state_ = 6;
        stopCheckIntervalTimeoutTimer_();
        feedDataPause__();
        return true;
    }
    function feedDataPause__() {
        var command = "e";
        socket_.send(command);
        if (wrp_.TRACE) wrp_.TRACE("<- " + command);
        return true;
    }

    // 音声認識サーバに接続中かどうかの取得
    function isConnected_() {
        return (state_ === 2 || state_ === 3 || state_ === 4 || state_ === 5 || state_ === 6 || state_ === 7 || state_ === 23 || state_ === 27 || state_ === 34 || state_ === 36);
    }

    // 音声データの供給中かどうかの取得
    function isActive_() {
        return (state_ === 5);
    }

    // 録音の停止を自動的に行うためのタイマの開始
    function startCheckIntervalTimeoutTimer_() {
        if (wrp_.checkIntervalTime - 1000 <= 0) {
            return;
        }
        stopCheckIntervalTimeoutTimer_();
        checkIntervalTimeoutTimerId_ = setTimeout(fireCheckIntervalTimeoutTimer_, wrp_.checkIntervalTime - 1000);
        if (wrp_.TRACE) wrp_.TRACE("INFO: started check interval time timer: " + wrp_.checkIntervalTime + "(-1000)");
    }

    // 録音の停止を自動的に行うためのタイマの停止
    function stopCheckIntervalTimeoutTimer_() {
        if (checkIntervalTimeoutTimerId_ !== null) {
            clearTimeout(checkIntervalTimeoutTimerId_);
            checkIntervalTimeoutTimerId_ = null;
            if (wrp_.TRACE) wrp_.TRACE("INFO: stopped check interval time timer: " + wrp_.checkIntervalTime + "(-1000)");
        }
    }

    // 録音の停止を自動的に行うためのタイマの発火
    function fireCheckIntervalTimeoutTimer_() {
        if (wrp_.TRACE) wrp_.TRACE("INFO: fired check interval time timer: " + wrp_.checkIntervalTime + "(-1000)");
        feedDataPause_();
    }

    // サービス認証キー文字列の発行
    function issue_() {
        if (!window.XMLHttpRequest) {
            if (wrp_.TRACE) wrp_.TRACE("ERROR: can't issue service authorization (Unsupported XMLHttpRequest class)");
            return false;
        }
        if (wrp_.issuerURLElement) wrp_.issuerURL = wrp_.issuerURLElement.value;
        if (wrp_.sidElement) wrp_.sid = wrp_.sidElement.value;
        if (wrp_.spwElement) wrp_.spw = wrp_.spwElement.value;
        if (wrp_.epiElement) wrp_.epi = wrp_.epiElement.value;
        if (!wrp_.sid) {
            if (wrp_.TRACE) wrp_.TRACE("ERROR: can't issue service authorization (Missing service id)");
            alert("サービス ID が設定されていません。");
            if (wrp_.sidElement) wrp_.sidElement.focus();
            return false;
        }
        for (var i = 0; i < wrp_.sid.length; i++) {
            var c = wrp_.sid.charCodeAt(i);
            if (!(c >= 0x30 && c <= 0x39 || c >= 0x61 && c <= 0x7A || c >= 0x41 && c <= 0x5A || c === 0x2D || c === 0x5F)) {
                if (wrp_.TRACE) wrp_.TRACE("ERROR: can't issue service authorization (Illegal char in service id)");
                if (wrp_.sidElement) alert("サービス ID に許されていない文字が使用されています。");
                if (wrp_.sidElement) wrp_.sidElement.focus();
                return false;
            }
        }
        if (!wrp_.spw) {
            if (wrp_.TRACE) wrp_.TRACE("ERROR: can't issue service authorization (Missing service password)");
            alert("サービスパスワードが設定されていません。");
            if (wrp_.spwElement) wrp_.spwElement.focus();
            return false;
        }
        for (var i = 0; i < wrp_.spw.length; i++) {
            var c = wrp_.spw.charCodeAt(i);
            if (c < 0x20 || c > 0x7E) {
                if (wrp_.TRACE) wrp_.TRACE("ERROR: can't issue service authorization (Illegal char in service password)");
                if (wrp_.spwElement) alert("サービスパスワードに許されていない文字が使用されています。");
                if (wrp_.spwElement) wrp_.spwElement.focus();
                return false;
            }
        }
        for (var i = 0; i < wrp_.epi.length; i++) {
            var c = wrp_.epi.charCodeAt(i);
            if (c < 0x30 || c > 0x39) {
                if (wrp_.TRACE) wrp_.TRACE("ERROR: can't issue service authorization (Illegal char in pexires in)");
                if (wrp_.epiElement) alert("有効期限に許されていない文字が使用されています。");
                if (wrp_.epiElement) wrp_.epiElement.focus();
                return false;
            }
        }
        if (wrp_.issueStarted) wrp_.issueStarted();
        var searchParams = "sid=" + encodeURIComponent(wrp_.sid) + "&spw=" + encodeURIComponent(wrp_.spw);
        if (wrp_.epi) {
            searchParams += "&epi=" + encodeURIComponent(wrp_.epi);
        }

        // APIに音声データを送信して文字起こしを実行する
        var httpRequest = new XMLHttpRequest();
        httpRequest.addEventListener("load", function (e) {
            if (e.target.status === 200) {
                if (wrp_.serviceAuthorizationElement) {
                    wrp_.serviceAuthorizationElement.value = e.target.response;
                } else
                    if (wrp_.authorizationElement) {
                        wrp_.authorizationElement.value = e.target.response;
                    } else {
                        wrp_.serviceAuthorization = e.target.response;
                    }
                if (wrp_.issueEnded) wrp_.issueEnded(e.target.response);
            } else {
                if (wrp_.issueEnded) wrp_.issueEnded("");
            }
        });
        httpRequest.addEventListener("error", function (e) {
            if (wrp_.issueEnded) wrp_.issueEnded("");
        });
        httpRequest.addEventListener("abort", function (e) {
            if (wrp_.issueEnded) wrp_.issueEnded("");
        });
        httpRequest.addEventListener("timeout", function (e) {
            if (wrp_.issueEnded) wrp_.issueEnded("");
        });
        //  送信箇所
        httpRequest.open("POST", wrp_.issuerURL, true);
        httpRequest.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        httpRequest.send(searchParams);
        return true;
    }

    // public プロパティの初期化
    if (recorder_) {
        wrp_.version += " " + recorder_.version;
    }
    wrp_.serverURL = ((window.location.protocol === "https:") ? "wss:" : "ws:") + "//" + window.location.host + window.location.pathname;
    wrp_.serverURL = wrp_.serverURL.substring(0, wrp_.serverURL.lastIndexOf('/'));
    if (wrp_.serverURL.indexOf("/tool", wrp_.serverURL.length - 5) !== -1) {
        wrp_.serverURL = wrp_.serverURL.substring(0, wrp_.serverURL.length - 5);
    }
    wrp_.serverURL += "/";
    wrp_.grammarFileNames = "-a-general";
    wrp_.issuerURL = window.location.protocol + "//" + window.location.host + window.location.pathname;
    wrp_.issuerURL = wrp_.issuerURL.substring(0, wrp_.issuerURL.lastIndexOf('/'));
    if (wrp_.issuerURL.indexOf("/tool", wrp_.issuerURL.length - 5) !== -1) {
        wrp_.issuerURL = wrp_.issuerURL.substring(0, wrp_.issuerURL.length - 5);
    }
    wrp_.issuerURL += "/issue_service_authorization";

    // public オブジェクトの返却
    return wrp_;
}();

// ================================ 音声の文字書き起こし処理 ================================
window.__textEmotion =
    (function () {
        function sanitize_(s) {
            return s.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/'/g, '&apos;')
                .replace(/"/g, '&quot;');
        }

        // 「voiceText」が書き起こした文字
        let voiceText;
        let voiceTextEnding;

        // 文章、音節を自動的に区切って検出する
        function append_(item) {

            if (item.length == 0) {
                return;
            }
            if (item == "<->") {
                return;
            }

            let itemState = 0;
            for (let i = 0; i < item.length; i++) {
                let c = item.charCodeAt(i);
                if (itemState == 0) {
                    if (c == 0x005F) {
                        break;
                    } else
                        if (c == 0x4E00 || c == 0x4E8C || c == 0x4E09 || c == 0x56DB || c == 0x4E94 || c == 0x516D || c == 0x4E03 || c == 0x516B || c == 0x4E5D) { // '一'～'九'
                            itemState = 1;
                        } else
                            if (c == 0x5341) { // '十'
                                itemState = 2;
                            } else
                                if (c == 0x767E) { // '百'
                                    itemState = 4;
                                } else
                                    if (c == 0x5343) { // '千'
                                        itemState = 8;
                                    } else {
                                        break;
                                    }
                } else {
                    if (c == 0x005F) {
                        item = item.substr(0, i) + item.substr(i + 1);
                        break;
                    } else
                        if (c == 0x4E00 || c == 0x4E8C || c == 0x4E09 || c == 0x56DB || c == 0x4E94 || c == 0x516D || c == 0x4E03 || c == 0x516B || c == 0x4E5D) { // '一'～'九'
                            if ((itemState & 1) != 0) {
                                break;
                            } else {
                                itemState |= 1;
                            }
                        } else
                            if (c == 0x5341) { // '十'
                                if ((itemState & 2) != 0) {
                                    break;
                                } else {
                                    itemState |= 2;
                                    itemState &= ~1;
                                }
                            } else
                                if (c == 0x767E) { // '百'
                                    if ((itemState & 6) != 0) {
                                        break;
                                    } else {
                                        itemState |= 4;
                                        itemState &= ~1;
                                    }
                                } else
                                    if (c == 0x5343) { // '千'
                                        if ((itemState & 14) != 0) {
                                            break;
                                        } else {
                                            itemState |= 8;
                                            itemState &= ~1;
                                        }
                                    } else {
                                        break;
                                    }
                }
            }

            item = item.replace(/_/g, " ");
            let itemBeginningChar = item.charCodeAt(0);
            let itemEndingChar = (item.length > 1) ? item.charCodeAt(item.length - 1) : 0;
            if (voiceTextEnding == 0) {
                let itemBeginning;
                let c = itemBeginningChar;
                if (c == 0x0020) {
                    itemBeginning = 0;
                } else
                    if (c == 0x0021
                        || c == 0x002C
                        || c == 0x002E
                        || c == 0x003A
                        || c == 0x003B
                        || c == 0x003F) {
                        itemBeginning = 5;
                    } else
                        if (c == 0x3001
                            || c == 0x3002
                            || c == 0xFF01
                            || c == 0xFF0C
                            || c == 0xFF0E
                            || c == 0xFF1A
                            || c == 0xFF1B
                            || c == 0xFF1F) {
                            itemBeginning = 6;
                        } else {
                            itemBeginning = 7;
                        }
                if (itemBeginning == 0
                    || itemBeginning == 5
                    || itemBeginning == 6) {
                    if (voiceText.length > 0) {
                        voiceText = voiceText.substr(0, voiceText.length - 1);
                    }
                }
            } else {
                let itemBeginning;
                let c = itemBeginningChar;
                if (c == 0x0020) {
                    itemBeginning = 0;
                } else
                    if (c >= 0x0041 && c <= 0x005A
                        || c >= 0x0061 && c <= 0x007A
                        || c >= 0x0100 && c <= 0x0DFF
                        || c >= 0x0E60 && c <= 0x01FF) {
                        itemBeginning = 1;
                    } else
                        if (c >= 0xFF21 && c <= 0xFF3A
                            || c >= 0xFF41 && c <= 0xFF5A) {
                            itemBeginning = 2;
                        } else
                            if (c >= 0x0030 && c <= 0x0039) {
                                itemBeginning = (voiceTextEnding == 8 && itemEndingChar == 0) ? 8 : 3;
                            } else
                                if (c >= 0xFF10 && c <= 0xFF19) {
                                    itemBeginning = (voiceTextEnding == 9 && itemEndingChar == 0) ? 9 : 4;
                                } else
                                    if (c == 0x0021
                                        || c == 0x002C
                                        || c == 0x002E
                                        || c == 0x003A
                                        || c == 0x003B
                                        || c == 0x003F) {
                                        itemBeginning = 5;
                                    } else
                                        if (c == 0x3001
                                            || c == 0x3002
                                            || c == 0xFF01
                                            || c == 0xFF0C
                                            || c == 0xFF0E
                                            || c == 0xFF1A
                                            || c == 0xFF1B
                                            || c == 0xFF1F) {
                                            itemBeginning = 6;
                                        } else {
                                            itemBeginning = 7;
                                        }
                if (itemBeginning == 1 || voiceTextEnding == 1 && (itemBeginning == 2
                    || itemBeginning == 3
                    || itemBeginning == 4
                    || itemBeginning == 7)
                    || voiceTextEnding == 2 && (itemBeginning == 2)
                    || voiceTextEnding == 3 && (itemBeginning == 3
                        || itemBeginning == 4)
                    || voiceTextEnding == 4 && (itemBeginning == 3
                        || itemBeginning == 4)
                    || voiceTextEnding == 5 && (itemBeginning == 2
                        || itemBeginning == 3
                        || itemBeginning == 4
                        || itemBeginning == 7)
                    || voiceTextEnding == 8 && (itemBeginning == 3
                        || itemBeginning == 4)
                    || voiceTextEnding == 9 && (itemBeginning == 3
                        || itemBeginning == 4)) {
                    voiceText += " ";
                }
            }
            voiceText += item;
            c = (itemEndingChar == 0) ? itemBeginningChar : itemEndingChar;
            if (c == 0x0020) {
                voiceTextEnding = 0;
            } else
                if (c >= 0x0041 && c <= 0x005A
                    || c >= 0x0061 && c <= 0x007A
                    || c >= 0x0100 && c <= 0x0DFF
                    || c >= 0x0E60 && c <= 0x01FF) {
                    voiceTextEnding = 1;
                } else
                    if (c >= 0xFF21 && c <= 0xFF3A
                        || c >= 0xFF41 && c <= 0xFF5A) {
                        voiceTextEnding = 2;
                    } else
                        if (c >= 0x0030 && c <= 0x0039) {
                            voiceTextEnding = (itemEndingChar == 0) ? 8 : 3;
                        } else
                            if (c >= 0xFF10 && c <= 0xFF19) {
                                voiceTextEnding = (itemEndingChar == 0) ? 9 : 4;
                            } else
                                if (c == 0x0021
                                    || c == 0x002C
                                    || c == 0x002E
                                    || c == 0x003A
                                    || c == 0x003B
                                    || c == 0x003F) {
                                    voiceTextEnding = 5;
                                } else
                                    if (c == 0x3001
                                        || c == 0x3002
                                        || c == 0xFF01
                                        || c == 0xFF0C
                                        || c == 0xFF0E
                                        || c == 0xFF1A
                                        || c == 0xFF1B
                                        || c == 0xFF1F) {
                                        voiceTextEnding = 6;
                                    } else {
                                        voiceTextEnding = 7;
                                    }
        }

        // ================================ 録音開始&停止ボタン ================================
        function disconnectEnded() {

            // 録音の開始
            resumePauseButton.innerHTML = "録音の開始";
            resumePauseButton.disabled = false;
            resumePauseButton.classList.remove("sending");
        }

        // ================================ 録音中&停止ボタン ================================
        function feedDataResumeEnded() {

            resumePauseButton.innerHTML = "<br><br>音声データの録音中...<br><br><span class=\"supplement\">クリック → 録音の停止</span>";
            resumePauseButton.disabled = false;
            resumePauseButton.classList.add("sending");

        }
        // ================================ 音声認識処理の最中 ================================
        function resultUpdated(result) {

            try {
                let json = JSON.parse(result);
            } catch (e) {
                if (result.indexOf("\x01") == -1) {
                } else {
                    let fields = result.split("\x01");
                    let fields0 = fields[0].split("|");
                    voiceTextEnding = 0;
                    let i, j;
                    for (i = 0; i < fields0.length; i++) {
                        let written = fields0[i];
                        if ((j = written.indexOf(" ")) != -1) {
                            written = written.slice(0, j);
                        }
                        if ((j = written.indexOf(":")) != -1) {
                            written = written.slice(0, j);
                        }
                        if ((j = written.indexOf("\x03")) != -1) {
                            written = written.slice(0, j);
                        }
                        append_(written);
                    }
                }
            }

            this.recognitionResultText.innerHTML = voiceText;
        }
        // ================================ 認識処理 ================================
        function resultFinalized(result) {
            this.time0 = 0;
            this.time2 = new Date().getTime() - this.time2;
            this.confidence = -1.0;
            try {
                let json = JSON.parse(result);
                voiceText = (json.text) ? sanitize_(json.text) : (json.code != 'o' && json.message);
                if (json.results && json.results[0]) {
                    if (this.time0 == 0) {
                        this.time0 = json.results[0].endtime;
                    }
                    this.confidence = json.results[0].confidence;
                }
            } catch (e) {
                if (result.indexOf("\x01") == -1) {
                } else {
                    let fields = result.split("\x01");
                    let fields0 = fields[0].split("|");
                    voiceTextEnding = 0;

                    let i, j;
                    for (i = 0; i < fields0.length; i++) {
                        let written = fields0[i];
                        if ((j = written.indexOf(" ")) != -1) {
                            written = written.slice(0, j);
                        }
                        if ((j = written.indexOf(":")) != -1) {
                            written = written.slice(0, j);
                        }
                        if ((j = written.indexOf("\x03")) != -1) {
                            written = written.slice(0, j);
                        }
                        append_(written);
                    }
                    voiceText = (voiceText) ? sanitize_(voiceText) : "<font color=\"gray\">(なし)</font>";
                    if (this.time0 == 0) {
                        this.time0 = parseInt(fields[2].split("-")[1]);
                    }
                    this.confidence = parseFloat(fields[1]);
                }
            }
            // ================================ 書き起こした文字を表示 ================================

            console.log(voiceText);

            // ================================ Ajax/Axios非同期通信処理 ================================
            // axios送信用のデータを用意
            // 引数：文字起こししたテキストデータ
            // 返り値：axos送信用データ
            const readyAxios = function (textData) {
                axiosReadyData = { documents: [{ id: "1", text: textData }] }
                return axiosReadyData
            };


            // 通信して結果をfirebaseに送信する
            const sendAxios = (text) => {
                const axiosdata = readyAxios(text)
                // APIのエンドポイントに送る
                axios.post(__TEXT_URL, axiosdata, {
                    headers: { 'Ocp-Apim-Subscription-Key': __TEXT_KEY },
                }).then((res) => {
                    console.log("ポジティブ:" + res.data.documents[0].confidenceScores.positive)
                    console.log("ネガティブ:" + res.data.documents[0].confidenceScores.negative)
                    __DB.sendData('text', {
                        positive: res.data.documents[0].confidenceScores.positive,
                        negative: res.data.documents[0].confidenceScores.negative
                    })
                }).catch((error) => {
                    console.log(error)
                });
            }

            // 文節ごとに送信
            if (!voiceText == false) {
                sendAxios(voiceText);
            }
        }

        // ================================ 認証情報 ================================
        // setting.jsなどから情報を読み込む
        let grammarFileNames = document.getElementsByClassName("grammarFileNames");
        let issuerURL = __SPEACH_TO_TEXT_URL;
        let sid = __SPEACH_TO_TEXT_USER_ID;
        let spw = __SPEACH_TO_TEXT_USER_PW;
        let recognitionResultText = document.getElementsByClassName("recognitionResultText");

        serverURL.value = "wss://acp-api.amivoice.com/v1/";
        //setting.jsに記載したAPP KEYを取得する
        authorization.value = __SPEACH_TO_TEXT_API_KEY;
        grammarFileNames[0].value = '-a-general';

        //音声認識ライブラリのプロパティ要素の設定
        Wrp.serverURLElement = serverURL;
        Wrp.grammarFileNamesElement = grammarFileNames[0];
        Wrp.authorizationElement = authorization;
        Wrp.issuerURLElement = issuerURL;
        Wrp.sidElement = sid;
        Wrp.spwElement = spw;
        Wrp.name = "";
        Wrp.recognitionResultText = recognitionResultText[0];
        Wrp.disconnectEnded = disconnectEnded;
        Wrp.feedDataResumeEnded = feedDataResumeEnded;
        Wrp.resultFinalized = resultFinalized;
        // 録音の開始
        const recordingStart = async function () {
            // 音声認識サーバへの音声データの供給中かどうかのチェック
            if (Wrp.isActive()) {
                // グラマファイル名が指定されている場合...
                // 音声認識サーバへの音声データの供給の開始
                Wrp.feedDataPause();
                // ボタンの制御
                resumePauseButton.disabled = true;
            } else {
                // 音声認識サーバへの音声データの供給中でない場合...
                // グラマファイル名が指定されているかどうかのチェック
                if (Wrp.grammarFileNamesElement.value != "") {
                    // グラマファイル名が指定されている場合...
                    // 音声認識サーバへの音声データの供給の開始
                    Wrp.feedDataResume();
                    // ボタンの制御
                    resumePauseButton.disabled = true;
                } else {
                }
            }
        };
        // ================================ 発火 ================================
        // 通話開始ボタンが押されたら文字起こしと感情分析を開始する
        const StartEmotionAnalysis = document.getElementById("make-call");
        StartEmotionAnalysis.addEventListener("click", recordingStart);
    }
)();

