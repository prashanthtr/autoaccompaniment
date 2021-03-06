 
var mSol = [], pDur = 16;
var play = require("play");
 
var AC = play.audioContext;
var sh = play.scheduler;
var gain = play.gainNode;
var playAcc = play.playAcc; 

var input = null;

document.getElementById('tempo').addEventListener( "change", function(){		
		tempo = document.getElementById("tempo").value;
		//set delay range to 30ms
		delay_range = (2 *tempo )/ 600;
	}); 

var play_pattern = document.getElementById('play');			
play_pattern.addEventListener("click", playKanjira , true);

document.getElementById("stop").addEventListener("click",stop,false);

document.getElementById("Midi").addEventListener("click",function (){
    window.navigator.requestMIDIAccess().then( success, failure);
},false);


document.getElementById("dump").addEventListener("click",function(){
    var typ = document.getElementById("patType").value;
    var loc = window.location.pathname;
    var str = loc + " -- " + typ;
    if(typ == "a"){
	
	localStorage.setItem(str,acceptable);
    }
    else localStorage.setItem(str,unacceptable);
},false);


function stop(){

    if(gain.gain.value == 0){
		gain.gain.value = 1; 
    }
    else{
		gain.gain.value = 0;
		gain.disconnect();
    }
}


document.getElementById("resume").addEventListener("click",function(){
	
    gain.connect(AC.destination);
    gain.gain.value = 1; //stop playing and start playing from previous pattern
    
},true);

function onMIDIMessage( event){
    
    //midi format -- note on off, velocity, note number
    //console.log( event.data[0] + " " + event.data[1] + " " + event.data[2] );
    var stroke = mapMridangamKey(event.data[1]);
    var velocity = event.data[2];
    var time = event.timeStamp;
    play.selectStroke( stroke, velocity, time);	
    
    function mapMridangamKey( str){
    	if(str == "C2"){
	    return "num";
    	}
	else if( str == "B2"){
    	    return "dheem";
    	}
    	else return ".";
    }	

}

/*
document.onkeypress = function (e){
    debugger;
    var stroke = mapMridangamKey(String.fromCharCode(e.keyCode));
    var time = e.timeStamp;
    play.selectStroke( stroke, time);	
    
    function mapMridangamKey( str){
    	if(str == "a"){
		return "num";
    	}
	else if( str == "k"){
    	    return "dheem";
    	}
    	else return ".";
    }	
    
}*/

function success(midiAccess){

    console.log( "MIDI ready!" );		
    input = midiAccess.inputs( )[4];
    input.onmidimessage = onMIDIMessage;

}


function failure(msg){
    alert("failure" + msg);
}


function playKanjira(){
    sh.running = true; 
    gain.connect(AC.destination);    
    //var dur = 300 * (60/tempo);
    //var song = sh.loop( sh.track ( sounds["jambupathe"].trigger(1.0), sh.delay(dur)));
    //sh.play(song);
    
    //keep looping mridangamkey for everykey
    //var mrkey = sh.loop(sh.track( [mridangamKey, sh.delay(60/tempo)]));

    play.keyPress();
    //ensure that only what was recently played is sent
    
    //play.playAcc("mridangam", mSol.slice(mSol.length - pDur, mSol.length), [1], [0,0,4]); //triggers the stroked to be played in the output
    //play.playAcc("kanjira", [], [], []);
}

