//メッセージ表示
const mBtn = document.querySelector(".m-btn");
const mListbox = document.querySelector(".m-listbox");
mBtn.addEventListener("click", function () {
    mListbox.style.transform = "translate(-50%,-50%) scale(1)";
})

//メッセージ
const imgMask = document.getElementsByClassName("img-mask");
const sendBtn = document.querySelector(".send-btn");
const mImg = document.querySelectorAll(".m-imgbox img");
for (let i = 0; i < imgMask.length; i++) {
    imgMask[i].addEventListener("click", function () {
        if (i == 0) {
            imgMask[i].style.opacity = "0";
            imgMask[1].style.opacity = "1";
            imgMask[2].style.opacity = "1";
            imgMask[3].style.opacity = "1";
        }
        if (i == 1) {
            imgMask[i].style.opacity = "0";
            imgMask[0].style.opacity = "1";
            imgMask[2].style.opacity = "1";
            imgMask[3].style.opacity = "1";
        }
        if (i == 2) {
            imgMask[i].style.opacity = "0";
            imgMask[0].style.opacity = "1";
            imgMask[1].style.opacity = "1";
            imgMask[3].style.opacity = "1";
        }
        if (i == 3) {
            imgMask[i].style.opacity = "0";
            imgMask[0].style.opacity = "1";
            imgMask[1].style.opacity = "1";
            imgMask[2].style.opacity = "1";
        }
        sendBtn.style.transform = "translate(-50%,-50%) scale(1)";
    })
}
//メッセージ送信
sendBtn.addEventListener("click", function () {
    for (let i = 0; i < imgMask.length; i++) {
        if (imgMask[i].style.opacity == "0") {
            console.log(mImg[i]);
            __DB.sendMsgNumber(i)
            swal("送信しました");
            imgMask[i].style.opacity = "1";
            mListbox.style.transform = "translate(-50%,-50%) scale(0)";
        }
    }
})

//閉じるボタン
const closeBtn = document.querySelector(".close")

closeBtn.addEventListener("click", function () {
    for (let i = 0; i < imgMask.length; i++) {
        imgMask[i].style.opacity = "1";
    }
    mListbox.style.transform = "translate(-50%,-50%) scale(0)";
})