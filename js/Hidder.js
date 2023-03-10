class Hidder{
    static blurryClassList = ".amountGreen"
    constructor(){
        this.insertButton()
        this.loadEvent()
    }

    //Todo Gestion du setting hide
    //set
    //get
    //load

    insertButton(){
        let button  = document.createElement('img')
        button.style = "width: 20px;"
        button.id = "hideButton"

        this.spanHeaderAmmount  =  document.querySelector(".dbl.fs14.fw7.lh18.elp")
        this.spanHeaderText = document.querySelector(".dbl.fs1.elp")

        this.spanHeaderText.append(button)

    }

    loadElement(){
        this.spanHeaderAmmount  =  document.querySelector(".dbl.fs14.fw7.lh18.elp")
        this.spanHeaderText = document.querySelector(".dbl.fs1.elp")

        this.hideButton = document.querySelector("#hideButton") 
        this.blurryDivs = document.querySelectorAll(".amountGreen") 
    }

    loadEvent(){
        this.loadElement()
        this.enableBlurry()

        this.hideButton.addEventListener('click', () =>{
            if(this.isBlurry())
                return this.disableBlurry()
             
            return this.enableBlurry()
            
        })
    }

    enableBlurry(){        
        this.loadElement()

        this.spanHeaderAmmount.style = "filter: blur(6px);" 
        this.blurryDivs.forEach(x =>{
            x.style = "filter: blur(6px);" 
        }) 
        this.hideButton.src = chrome.runtime.getURL("asset/eyeClose.png")
    }

    disableBlurry(){
        this.loadElement()

        this.spanHeaderAmmount.style = "" 
        this.blurryDivs.forEach(x =>{
            x.style = "" 
        })
        this.hideButton.src = chrome.runtime.getURL("asset/eye.png")
    }

    isBlurry(){
        this.loadElement()

        if(this.spanHeaderAmmount.getAttribute("style").indexOf("filter:") != -1)
            return true
        return false
    }

}