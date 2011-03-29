var backgroundPage = chrome.extension.getBackgroundPage();
var currentFramegrab;
var tabId;
var tabUrl;


$(document).ready( function() {
	// get the current tab
	chrome.tabs.getSelected(null, function(tab) {
		tabId = tab.id;
		tabUrl = tab.url;
		// get the most recent framegrab, if there is one
        if (tabUrl.slice(0,4) === "http") { // bit of a hack: matches pages other than those with data and chrome URLs, etc. 
    		chrome.tabs.sendRequest(tabId, {"type": "getCurrentFramegrab"}, initPage);	
        } else { 
            initPage();
        }        
	});	
	
	$("#deleteAllButton").click(function() {
        if (confirm("Delete all framegrabs stored for this video?")) {
        	$("#framegrabImages").empty();
        	backgroundPage.deleteFramegrabs($("#pageSelect").val(), $("#videoSelect").val());
            close();
        }
    });		
	
});


// workaround for lack of Inspect Popup in Chrome 4 -- copes with strings and other objects
function clog(val) {
	var message = JSON.stringify(val).replace(/\n/g, " ");
	chrome.tabs.sendRequest(tabId, {"type": "consoleLog", "value": message});	
}


function goToFramegrab(timecode) {
    var request = {"type": "displayFramegrabFromPopup", "pageUrl": $("#pageSelect").val(), "timecode": timecode, "videoSrc": $("#videoSelect").val()};    
        if (tabUrl.slice(0,4) === "http") { // bit of a hack: matches pages other than those with data and chrome URLs, etc. 
    		chrome.tabs.sendRequest(tabId, request, function(response){});
        } else { 
            backgroundPage.displayFramegrabFromNewTab(tabId, request);
        }
}

function addFramegrab(dataUrl, timecode) {
	// build the HTML for each framegrab
	var jFramegrab = $("<div />");
    if (!dataUrl) {
        jFramegrab.addClass("noFramegrab");
    }

    // add the timecode
	var jTimecode = $("<div class='framegrabTimecode' title='Click to view video for this timecode' src='images/delete.png' />");
    jTimecode.click(function(){goToFramegrab(timecode)});
	jTimecode.append(timecode);
	jFramegrab.append(jTimecode);

	// add delete function
	var jDelete = $("<img class='deleteFramegrab' title='Delete this framegrab' src='images/delete.png' />");
	jDelete.click(function(){
		jFramegrab.fadeOut("slow", 
			function(){
				jFramegrab.remove();
				if ($("#framegrabImages img.framegrab").length === 0) {
					close();
				}
			}
		);
		var videoSrc = $("#videoSelect").val();
		backgroundPage.doQuery("DELETE FROM framegrabs WHERE pageURL='" + tabUrl + "' AND videoSrc='" + videoSrc + "' AND timecode='" + timecode + "'", null);		 
	});
	jFramegrab.append(jDelete);

	// add save function
	var jSave = $("<img class='saveFramegrab' title='Open this framegrab in a new tab: \n it can then be saved locally as a JPEG file' src='images/openFramegrabInNewTab.png' />");
	jSave.click(function(){
        // document.location.href = datUrl;
        // window.open(dataUrl);
        chrome.tabs.create({"url": dataUrl, "selected": false}, function(){});
	});
	jFramegrab.append(jSave);

	// add framegrab image if there is one, or else use images/noFramegrab.png
    var jFramegrabImg = $("<img class='framegrab' title='Click to view video for this timecode' />");
    jFramegrabImg.attr("src", (dataUrl ? dataUrl : "images/noFramegrab.png"));
	jFramegrabImg.click(function(){goToFramegrab(timecode)});
	jFramegrab.append(jFramegrabImg);    

	$("#framegrabImages").append(jFramegrab);	
}

function setFramegrabContainerSize() {
	var videoSrc = $("#videoSelect").val();
	$("#framegrabImages").css({"height": localStorage[videoSrc + "-height"] + "px", "width": localStorage[videoSrc + "-width"] + "px"});
}

// called as callback from backgroundPage.getData() call in setupSelectors()
function setFramegrabs(framegrabs) {
	if (framegrabs && framegrabs.length > 0) {
		for (var i = 0; i != framegrabs.length; ++i) {
			var framegrab = framegrabs.item(i);
			addFramegrab(framegrab.dataUrl, framegrab.timecode.toFixed(2)); // 0.00 is stored as 0 despite FLOAT(2) data type
		}
		var videoSrc = $("#videoSelect").val();
        
		// set the framegrab container size -- any framegrab image will do: all have same height and width
        // note that if there is no framegrab, images/noFramegrab.png is used instead
		$("#framegrabImages img.framegrab:last").load(function() { 
			// load event is only called first time popup opened, but size needs to be saved even when the popup is closed and reopened
			// must also save values for multiple videos from the same domain -- hence use of videoSrc
			localStorage[videoSrc + "-height"] = $(this).height();
			// set width -- and if more than one image, add width for the scrollbars to #framegrabImages
			localStorage[videoSrc + "-width"] = $(this).width() + (framegrabs.length > 1 ? 18 : 0); 
			setFramegrabContainerSize();
			// if the most recent framegrab is from the current page, display it 
			// videoSelect and pageSelect values are selected for the current framegrab in setupSelectors()
			if (currentFramegrab && currentFramegrab.pageUrl === tabUrl && currentFramegrab.videoSrc === videoSrc) {
				scrollToFramegrab(currentFramegrab.timecode); 
			}
		});		
	} else {
		clog("No framegrabs");
	}
}

// handle query results from background page
// NB: pages is an SQLResultSetRowList, not an array
function buildPageSelect(pages) {
	if (pages && pages.length > 0) {
		$("div#framegrabs").show();
		for (var i = 0; i != pages.length; ++i) {
			var page =  pages.item(i);
			var pageTitle = page.pageTitle + ""; // make a String: page properties are of type Object
			var pageUrl = page.pageUrl + "";
			$("<option />").text(pageTitle).val(pageUrl).attr("title", pageUrl).appendTo("#pageSelect");
		}
		$("#pageSelect").val(tabUrl);
	} else {
		$("div#noFramegrabs").show();
	}
}

// called from buildVideoMap(), when video map data has been received
// the video select values are updated when the page selection changes
function setupSelectors(videoMap) {
	// add a change listener to pageSelect:
	// - when page selection changes, display the list of video stored for that page
	$("#pageSelect").change(function () {
		$("#videoSelect").empty();
		$("#pageSelect option:selected").each(function () { // to allow for multiple selection (not enabled at present)
			var pageUrl = $(this).val();
			// videoMap keys are page URLs, values are arrays of video URLs
			var videoSrcArray = videoMap[pageUrl];
			// add an option to #videoSelect for each video
			$.each(videoSrcArray, function(index, videoSrc) {					
				var videoFileName = videoSrc.split("/").pop();
	            $("<option />").text(videoFileName).val(videoSrc).attr("title", videoSrc).appendTo("#videoSelect");
			});
			if (currentFramegrab && tabUrl === currentFramegrab.pageUrl) {
				$("#videoSelect").val(currentFramegrab.videoSrc);
			}
			$("#videoSelect").change(); // update display of framegrabs for default selected video
		});
	});
	
	// add a callback to videoSelect change events: display framegrabs stored for the currently selected video(s)
	$("#videoSelect").change(function () {
		$("#framegrabImages").empty();
		// for each selected video, display stored framegrabs
		$("#videoSelect option:selected").each(function () { // to allow for multiple selection (not currently implemented)
			var videoSrc = $(this).val();
			var pageUrl = $("#pageSelect").val();
			// get framegrab timecodes and data URLs for this video
			backgroundPage.getData("SELECT dataUrl, timecode FROM framegrabs WHERE pageUrl ='" + pageUrl + 
				"' AND  videoSrc ='" + videoSrc + "' ORDER BY CAST(timecode AS FLOAT(2)) ASC", setFramegrabs); // doesn't seem to work without cast
		});
	});
	
	// update videos listed for current page
	$("#pageSelect").change(); 
	// update framegrabs displayed for current video
}

// handle query results from background page, getting page URL and video src value for each framegrab
// set up page and video selectors once the video map is built
// NB: videos argument is an SQLResultSetRowList, not an array
function buildVideoMap(videos) {
	var videoMap = {};
	if (videos && videos.length > 0) {
		for (var i = 0; i != videos.length; ++i) {
			var video = videos.item(i);
			if (videoMap[video.pageUrl] === undefined) {
				videoMap[video.pageUrl] = [];
			}
			videoMap[video.pageUrl].push(video.videoSrc);
		}
	}
	setupSelectors(videoMap);
}


function scrollToFramegrab(timecode) {
	try {
		var jTimecode = $("#framegrabImages div.framegrabTimecode:contains(" + timecode + ")");
		if (jTimecode.length === 0) {
			clog("Timecode element not found for value " + timecode);
			return false;
		}
		var jFramegrab = jTimecode.parent();
		var containerOffset = $("#framegrabImages").offset().top;
		var framegrabOffset = jFramegrab.offset().top;
		var framegrabScroll = framegrabOffset - containerOffset;
	//	jQuery.easing.def = framegrabScroll > 0 ? "easeOutBounce" : "easeInBounce";
		$("#framegrabImages").animate({scrollTop: "+=" + framegrabScroll + "px"}, 200); // object literal syntax doesn't work in Chrome :(
	} catch(e) {
		clog(("scrollToFramegrab() error: " + e.message));
	}
}

	
// NB: it doesn't matter that the following two calls are asynchronous: the video map is only used once the page select is built
function initPage(currentFramegrabForPage) {
	currentFramegrab = currentFramegrabForPage;	
    // get the list of stored pages from the background page
	backgroundPage.getData("SELECT DISTINCT pageTitle, pageUrl FROM framegrabs", buildPageSelect);		 
	// get the list of stored videos from the background page
	backgroundPage.getData("SELECT DISTINCT pageUrl, videoSrc FROM framegrabs", buildVideoMap);		 	
}

/*
chrome.extension.onRequest.addListener(
	function(request, sender, sendResponse) {
		if (request.type === "") {
		;
		} else {
			alert("Unknown request type in popup.js: " + request.type);
		}
	}
);
*/




