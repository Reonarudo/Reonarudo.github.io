document.getElementById('theme-toggle').addEventListener('click',function(){
  var r=document.documentElement,dark=r.dataset.theme==='dark';
  if(dark)delete r.dataset.theme;else r.dataset.theme='dark';
  localStorage.setItem('lab-dark',dark?'0':'1');
});
