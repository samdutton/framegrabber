Framegrabber

Framegrabs are still images of individual film frames.

The Framegrabber extension makes it possible to take framegrabs from HTML5 video. Framegrabs can be stored in a local database or opened in a tab so they can be saved as JPEG files. 

Framegrabber is also useful for bookmarking video timecodes.

Framegrabber works for any page that uses the HTML video element. 

One major caveat: to take framegrabs, video must be from the same host as the page it's on, so Framegrabber can't take framegrabs on sites like YouTube and Vimeo. If Framegrabber cannot take a framegrab, it stores only the current timecode.

Videos that work with Framegrabber can be found on many sites:
- Dive Into HTML5: http://diveintohtml5.org/video.html#example
- Mozilla examples: http://people.mozilla.com/~prouget/demos/mashup/video.xhtml
- my own website: samdutton.com.

.......................

How to use Framegrabber

To save framegrabs, use the icons that the extension displays at the top left of video(s) using the HTML video element:
- click on the green plus icon to open a framegrab in a new tab 
- click on the red circle icon to save a framegrab in local database storage. 

Note that on some pages, you may need to start playing the video before an HTML video element is actually added to the page.

Click the extension icon (to the right of the address bar) to display stored framegrabs in a popup. Click a framegrab image in the popup to navigate to the video and timecode from which the framegrab was taken.


How does it work?

Framegrabber uses several relatively new browser technologies, including Canvas, HTMLMediaElement and Web SQL Database.

Below are some technical details of how the extension works.

Framegrabber creates a canvas element (but doesn't add it to the DOM) then uses the drawImage() canvas context method to draw a video frame on it. The canvas toDataURL() method is then used to create a data URL string representing the image. The image data URL can then either be opened in a new tab, or stored locally along with the URL of the page containing the video and the timecode of the framegrab. Except in order to view pages containing framegrabs, no server or internet access is required.

Local storage is accomplished using the Chrome Web SQL Database implementation, which is fast and reliable enough to store strings such as image data URLs, which can be 200KB or more in size (i.e. 200,000+ characters in length). 

When the extension icon is clicked, data URLs are retrieved from the local database and set as the src value for framegrabs displayed in the popup. 


Feedback

Please send bug reports, comments or feature requests to samdutton@gmail.com.

For more information, please visit my website samdutton.com or my blog at samdutton.wordpress.com.
