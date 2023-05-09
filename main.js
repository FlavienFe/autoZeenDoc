const pptr = require('puppeteer-core');
const find = require('find-process');
const process = require('node:process');

const keyBinds = {
  //keyCode: id_tampon
  //"KeyV":32,
  //"KeyR":44,
  //"KeyN":-1,
  "KeyV":1,
  "KeyR":2,
  "KeyN":-1,
}
const chemin_chrome = "C:\\Program\ Files\\Google\\Chrome\\Application\\chrome.exe"; // Normalement ne change pas
const chemin_userData = ".\\ZeenDocData"; // Profile Path (On peut créer un dossier vide)

async function clickOnElement(elem,p, f=p, x = null, y = null) {
    const rect = await f.evaluate(el => {
      const { top, left, width, height } = el.getBoundingClientRect();
      return { top, left, width, height };
    }, elem);
    // Use given position or default to center
    const _x = x !== null ? x : rect.width / 2;
    const _y = y !== null ? y : rect.height / 2;

    await p.mouse.click(rect.left + _x, rect.top + _y);
  }

async function keyBindListener(p){
      await p.evaluate((kb,id1,id2,k1,k2,k3)=>{
        //console.log("defining stampkeypressed")
        parent.window.stampkeypressed = 0
        parent.window.docNumber = 0
        window.addEventListener('keydown',(event)=>{
          var name = event.key;
          var code = event.code;
          if(name === 'Control'){
            return;
          }
          if (!event.ctrlKey && $("textarea[class='undraggable']").length==0){
            for (var prop in kb){
              if(code === prop){
                console.log("placement tampon " + kb[prop])
                parent.window.stampkeypressed = kb[prop]
              }
            }
            console.log({code})
            parent.window.docNumber = Number(parent.window.$('div[style="height: 170px; margin: 0px; padding: 5px; background: none rgb(255, 185, 151); border: none; width: 110px;"]')[0]?.className.split(" ")[1][15]); // a pour simple but de parse le chiffre de la page sélectionnée
          }else{
            return;
          }
        });
      },keyBinds)
}

async function putStampDown(p, inFrame = 0){
  var f = p;
  return await p.waitForFunction("window.stampkeypressed",{timeout:false}).then(async ()=>{
        if(inFrame){
          var currentframenb = await p.evaluate(()=>window.docNumber)
          f = await p.waitForSelector("#Iframe_"+currentframenb).then((e)=>e.contentFrame());
        }
        var stampID = await p.evaluate(()=>window.stampkeypressed);
        if (stampID>=0){
          await f.$eval("#Bouton_Ajouter_Tampon",(el)=>{el.click()})
          var frameHandle = await f.$("iframe[class='fancybox-iframe']");
          var frame = await frameHandle.contentFrame();
          await frame.waitForSelector(".Stamp")
          await new Promise(r => setTimeout(r, 400));
          console.log("#Stamp_"+stampID)
          await frame.$eval("#Stamp_"+stampID,(el)=>{el.click()}).catch((err)=>{console.log(err)})
          var elem = await f.waitForSelector("#ZDV_Pages")
          await new Promise(r => setTimeout(r, 800));
          await clickOnElement(elem, p, f);
          console.log("Tampon ID:" + stampID + " placé");
        }else{
          if(stampID = -1){
            await f.$eval("#Bouton_Ajouter_Commentaire",(el)=>{el.click()})
          }
        }
        console.log({stampID})
        return stampID
      }).catch((err)=>{console.log("le tampon n’a pas été placé: ")})
}

(async ()=>{
  //await find("name","chrome").then((list)=>{
    //console.log(list)
    //for (const proc of list){
      //console.log(proc)
      //process.kill(proc.pid)
    //}
  //})
  pptr.launch({
    pipe:true,
    defaultViewport:false,
    headless:false,
    executablePath: chemin_chrome,
    userDataDir: chemin_userData,
  }).then(async browser=>{
    browser.version().then(v=>console.log(v));
    const bs = await browser.waitForTarget((target)=> target.url().includes("blank"))
    const page = await bs.page();
    await page.goto("https://armoires.zeendoc.com/");
    await page.waitForSelector("#connexion")
    await new Promise(r => setTimeout(r, 500));
    await page.$eval("#connexion",(el)=>{el.click()})
    var indexDoc = 0;
    do{
      var popup = await browser.waitForTarget((target)=> target.url().includes("View/docs_view.php") || target.url().includes("Search/Indexation.php"),{timeout:false})
      console.log("Popup trouvée")
      var popupPage = await popup.page();
      if (popup.url().includes("Search/Indexation.php")){
        await popupPage.addScriptTag({path: "jquery.js"}) 
        await new Promise(r => setTimeout(r, 200));
        //var nbPages = await popupPage.$eval("#Conteneur_Iframes",(el)=>{console.log(el); return(el.children.length);})
        var nbPages = await popupPage.$eval(".column_documents",(el)=>el.children.length)
        for(let i=0; i<nbPages; i++){
          console.log("Écoute page " + i)
          await keyBindListener(await popupPage.waitForSelector("#Iframe_"+i).then((e)=>e.contentFrame())).catch((err)=>{console.log("erreur dans keybindlistener")})
        }
        await putStampDown(popupPage, 1).then(async(stampID)=>{
          var liste = await popupPage.$$(".column_documents>li").catch("page fermée");
          indexDoc = await popupPage.evaluate(()=>window.docNumber)
          console.log({stampID})
          popupPage.$eval('div[style="height: 170px; margin: 0px; padding: 5px; background: none rgb(255, 185, 151); border: none; width: 110px;"]>*>div',(el)=>{el.innerHTML = "Traité"})
          if(indexDoc<liste.length-1 && stampID>=0){
            await new Promise(r => setTimeout(r, 500));
            liste[indexDoc + 1].click();
          }
          else{
            //await popupPage.close().then(async()=>{
              //while(!popupPage.isClosed()){
              //await new Promise(r => setTimeout(r, 200));
              //}
            //}).catch((err)=>{console.log("page fermée")});
          }
        }).catch((err)=>(console.log("page fermée à putStampDown")));
      }
      else{
        await keyBindListener(popupPage);
        await putStampDown(popupPage);
        await new Promise(r => setTimeout(r, 500));
        await popupPage.close().then(async()=>{
          while(!popupPage.isClosed()){
           await new Promise(r => setTimeout(r, 200));
          }
        }).catch((err)=>{console.log("page fermée manuellement")});
        
      }
    }while(browser)
  }).catch(async error =>{console.log(error)});
})();
