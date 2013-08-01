

//Common functions that are used across all the modules

//generate array with base value
function generateBaseValue(duration, baseValue){
    var arr = [];
    for(var i=0; i<duration; i++){
	arr.push(baseValue);
    }
    return arr;
}

function getEle(htmlElement){
	if( !document.getElementById(htmlElement)){
		debugger;
	}
    return eval(document.getElementById(htmlElement).value);
}

//returns 1 if element found in array and returns 0 if no element is found
function arrElementCmp(element,array){
    var compare = 0;
    for(var index=0;index<array.length;index++){
	if(element == array[index]){compare = 1;}
    }
    return compare;
}

//generates whole random number between the given intervals
function wholeRand(low,high){
    return low + Math.floor( 0.5 + Math.random()*(high-low));
}

//returns num - sub % duration
function modnum(duration,num,sub){

    if(num - sub < 0){
	return duration + (num - sub)%duration;
    }
    else{
	return (num - sub)%duration;
    }
    
}

//finds maximum of 3
function maxi(a,b,c){
    if(a == b && a == c){
	return -1;
    }
    else{
	if(a > c && a>b){
	    return a;
	}
	else if(b>a && b>c){
	    return b;
	}
	else{
	    return c;
	}
    }
}

//generates array with unique values if documentelement is absent
function generateRandArr(duration, numValues){
    var arr = [];

    for(var i=0; i<numValues; i++){
	var acc = wholeRand(1,duration);
	if(arr.length ==0){
	    arr.push(acc);
	}
	else if( arrElementCmp(acc,arr) == 0 ){
	    arr.push(acc);
	}
	else{
	    while( arrElementCmp(acc,arr) == 1 ){
		acc = wholeRand(1,duration);
	    }
 	    arr.push(acc);
	}

    }
    return arr;
}

function modovr(num, modn ){
    if(num < 0){
	num = modn + num;
    }
    return num % modn;
}

function multiTo1DArr( multiSeq ){ 
    var singleSeq = [], arr2 = [];
    for(var i=0; i<multiSeq.length; i++){
	var arr = multiSeq[i];
	if(arr.length == 1){
	    singleSeq.push(multiSeq[i]);	    
	}
	else{
	    try{
		arr2 = arr.split(" ");
	    }
	    catch(err){
		arr2 = arr;
	    }
	    for(var i2=0;i2<arr2.length;i2++){
		singleSeq.push(arr2[i2]);
	    }	    
	}
    }
    
    return singleSeq;
}


function multiTo1D( multiArr){

	var  i =0, j =0, singleSeq = [];
	while( i< multiArr.length){
		j=0;
		var ar = multiArr[i];
		while( j < ar.length){
			singleSeq.push(	ar[j]);
			j++;			
		}
		i++;
	}
	return singleSeq;
}

//find position of occurences of element in an array
function findPosOccurences(ele,arr){
    
    var posArr = [];
    for(var i=0;i<arr.length;i++){
	var arele = arr[i];
	if(arele.length && ele.length){
	    if(arele.join("") == ele.join("")){
		posArr.push(i+1);
	    }
	}
	else{
	    if(arr[i] == ele){
		posArr.push(i+1);
	    }
	}

    }
    return posArr;

}

function normalize(fAccent){
	var num = fAccent[0], normAccent = [];
	if(numOccurences(num,fAccent) == fAccent.length){ // no accents
	    normAccent = fAccent.map(function(s,index){
		return 0;
	    });
	}
	else{
	    //adding the difference between successive accent levels
	    var sum = 0;
	    for(var index=0;index<fAccent.length;index++){	
		sum += Math.abs( fAccent[index]);
	    }

	    normAccent = fAccent.map(function(s,index){
		return s/sum;
	    });

	}
	return normAccent;	

}

//returns number of occurences of an element in a array
function numOccurences(ele,array){
    var count = 0;
    for(var index=0;index<array.length;index++){
	if(ele == array[index]){
	    count++;
	}
    }
    return count;
}

function sum(a,b){
    return a + b;
}




function findLcm(a,b){

	if( a % b ==0 ){
		return a;
	}
	else if( b % a == 0){
		return b;
	}
	else {
		var cd = gcd(a,b);
		return (a * b) / cd;
	}
	
	function gcd(a,b){

if( a == b){return a;}
else{
	if(a > b){
		return gcd( b, a - b);
	}
	else{
		return gcd( a, b- a);
	}
}

}

}


exports.getEle = getEle;
exports.generateBaseValue = generateBaseValue;
exports.findLcm = findLcm;
exports.arrElementCmp = arrElementCmp;
exports.maxi = maxi;
exports.modnum = modnum;
exports.sum = sum;
exports.multiTo1D = multiTo1D;
exports.wholeRand = wholeRand;