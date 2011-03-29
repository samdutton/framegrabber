function initVideos() {
    var jVideos = $("video");	
    numVideos = jVideos.length;
    
    chrome.extension.sendRequest({"type": "initBrowserAction", "numVideos": jVideos.length}, function(response) {}); // notify in order to change icon, badge and title
    if (numVideos > 0) {
    	jVideos.bind("loadedmetadata", handleVideoLoadedMetadata); 
    }
}

var numVideos;
initVideos();

// in case a video element is added dynamically, e.g. on Vimeo
$(document).bind('DOMNodeInserted', function(event) {
    if (event.target.nodeName === "VIDEO") {
//        console.log('inserted ' + event.target.nodeName + // new node
//            ' in ' + event.relatedNode.nodeName); // parent
        initVideos();
    }
});

$(document).ready( function() {
    // this is used when a user clicks on a framegrab in the popup
    // for a video on a page that is not in the current tab, i.e. has to be opened in a new tab
	// response is handled by listener below, with type displayFramegrabFromBackground
	chrome.extension.sendRequest({"type": "sendFramegrabToDisplay"}, function(response){});    
});


function handleVideoLoadedMetadata() {
	var jVideo = $(this);
	setTimeout(function() {
		addControls(jVideo);
	}, 100); // to ensure rendering has occurred
}


function addControls(jVideo) {
	var elVideo = jVideo[0];
    var pageUrl = location.href;
	var currentSrc = elVideo.currentSrc;
	var videoHeight = elVideo.videoHeight; // video size, not element size
	var videoWidth = elVideo.videoWidth;
	var elCanvas = document.createElement("canvas"); 
	elCanvas.height = videoHeight;
	elCanvas.width = videoWidth; 
//	console.log("videoHeight: " + videoHeight);
//	console.log("videoWidth: " + videoWidth);
//	console.log("jVideo.width(): " + jVideo.width());
	var canvasContext = elCanvas.getContext("2d");
	var videoLeft = jVideo.offset().left;
	var videoTop = jVideo.offset().top;
	var controlsCss = {"left": videoLeft + "px", "top": videoTop + "px"/*, "width": videoWidth + "px"*/};
	var jControls = $("<div class='framegrabberControls' />").css(controlsCss);
    
    var errorMessage;     
    function getDataUrl() {
		try {
            canvasContext.drawImage(elVideo, 0, 0, videoWidth, videoHeight);
			return elCanvas.toDataURL("image/jpeg"); // defaults to png in current versions despite this :-(
		} catch (e) { // hack: in practice, the only error thrown is a host security error
            var pageHost = jQuery.url.attr("host");
            var videoHost = jQuery.url.setUrl(currentSrc).attr("host");
            jQuery.url.setUrl(location.href);
            errorMessage = 
                "Sorry!\n\n" +
                "This video is from a different host than the page it's on,\n" +
                "so a framegrab can't be displayed in a new tab.\n\n" +
                "You can still store the timecode for the frame by clicking the red circle icon.\n\n" +
                "Technical details below.\n\n...................................................\n\n" + 
                e.message + 
                "\n\nVideo host: " + videoHost + "\n\nPage host: " + pageHost + "\n\n" +
                "(Note that the video source may resolve to a different host from that given in the video src attribute)";
            return "";
    	}
    }
    
    // open framegrab in new tab
	var openImgUrl = chrome.extension.getURL("images/openFramegrabInNewTab.png");
	var jOpenImg = $("<img class='openFramegrabInNewTab' title='Open framegrab in new tab' />").attr("src", openImgUrl).attr("id", currentSrc);
	jOpenImg.click(function(){
        var dataUrl = getDataUrl();
        if (dataUrl) {
            chrome.extension.sendRequest({"type": "openFramegrabInNewTab", "dataUrl": dataUrl}, function(response) {});
        } else {
            alert(errorMessage);
        }
    });
	jControls.append(jOpenImg);
    
    // save framegrab to local storage
	var grabImgUrl = chrome.extension.getURL("images/grab.png");
	var jGrabImg = $("<img class='grab' title='Save framegrab to local storage' />").attr("src", grabImgUrl).attr("id", currentSrc);
    
    // store the framegrab -- note that the data URL will be null if the video and the page are from different (sub)domains
	jGrabImg.click(function(){
        var dataUrl = getDataUrl();
        var request = {};
        request.pageTitle = document.title || pageUrl; // in case no title
        request.pageUrl = pageUrl;
        request.dataUrl = getDataUrl();
        request.timecode = timecode = elVideo.currentTime.toFixed(2);
        request.type = "storeFramegrab";
        request.videoSrc = currentSrc;
        chrome.extension.sendRequest(request); 		 
		// values used to set framegrab displayed when popup is opened
		localStorage["framegrabberCurrentPageUrl"] = pageUrl;
		localStorage["framegrabberCurrentVideoSrc"] = currentSrc;
		localStorage["framegrabberCurrentTimecode"] = timecode;		
	}); // jGrabImg.click()
	jControls.append(jGrabImg);

	$("body").prepend(jControls);
    
    // This is a bit of a hack: repositioning the controls if the position of the videos changes.
    // I can find no direct way to check if position of a video changes, 
    // e.g. when resizing the window or showing/hiding content.
	function positionControls() {
		var videoLeft = jVideo.offset().left;
		var videoTop = jVideo.offset().top;
		var controlsCss = {"left": videoLeft + "px", "top": videoTop + "px"};
		jControls.css(controlsCss);
	}    
	$(window).resize(positionControls); 
    $("body").bind('DOMSubtreeModified', positionControls);
    
/*
	jVideo.watch("left,offsetLeft,offsetTop,readyState,top", function() {
        console.log("change");
        alert("change");
		var videoLeft = jVideo.offset().left;
		var videoTop = jVideo.offset().top;
		var controlsCss = {"left": videoLeft + "px", "top": videoTop + "px"};
		jControls.css(controlsCss);
	});
*/
}


// called following request of type displayFramegrabFromPopup or displayFramegrabFromBackground
// -- when a user clicks on a framegrab in the popup, 
// this function displays the relevant video, starting at the timecode of the framegrab
function displayFramegrab(framegrab) {
	var elVideo = null;
	$("video").each(function(index) {
		if (this.currentSrc === framegrab.videoSrc) {        
            $("body").animate({scrollTop: $(this).offset().top - 50}, 200);
			elVideo = this;
			if (elVideo.readyState === 0) { // i.e. video not yet loaded
				$(elVideo).bind("loadedmetadata", function() {
					elVideo.currentTime = framegrab.timecode;
				});
			} else {
				elVideo.currentTime = framegrab.timecode;
			}
			return true; // only returns from closure
		}
	});
	if (elVideo === null) {
		console.log("No video element found on the page with the src requested: " + framegrab.videoSrc);
	}
}

chrome.extension.onRequest.addListener(
	function(request, sender, sendResponse) {
		var response = {};
		var pageUrlString, timecodeString;
		if (request.type === "consoleLog") {
			console.log(request.value);
		}
		else if (request.type === "displayFramegrabFromPopup") {
			if (location.href === request.pageUrl) {		
				displayFramegrab(request);	
			} else {
				// horribly complex...
				// tell the background page to store details for the framegrab to display
				// the background page then changes the url for the current tab
				chrome.extension.sendRequest(request, function(response) {});
			}
		} else if (request.type === "displayFramegrabFromBackground") {
			$(document).ready(function() {
				displayFramegrab(request);
			});
		} else if (request.type === "getCurrentFramegrab") {
			response.pageUrl = localStorage["framegrabberCurrentPageUrl"];
			response.videoSrc = localStorage["framegrabberCurrentVideoSrc"];
			response.timecode = localStorage["framegrabberCurrentTimecode"];		
		} else if (request.type === "sendNumVideos") {
			response = {"numVideos": numVideos};
		}
		else {
			console.log("Unknown request type: " + request.type);
		}
		sendResponse(response); // otherwise request remains open 
	}
);


// convenience methods added to JavaScript classe

Array.prototype.numericSort = function() {
	return this.sort(function(a, b) {
	    return a - b;
	});
};


String.prototype.truncate = function(maxLength) {
    if (this.length > maxLength) {
     return this.substring(0, maxLength) + "...";
    } else {
        return this;
    }
};