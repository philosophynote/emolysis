const btn = document.querySelector(".btn");
const consentC = document.getElementById("consentC");

// ボタンのイベント
btn.addEventListener("click",function () {
  if (consentC.checked) {
    //同意書のチェックが入っていればkranke.htmlに遷移
    location.pathname = '/kranke.html'
  } else {
    // 入っていない場合はアラート表示
    swal("同意書の同意がされていません。");
  }
})
