//(function () {

window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;


var form = document.querySelector("#download-form");

function ServerPool() {
    this.servers = {};
    this.downloadChunk = function(baseUrl, chunkId) {
    }
}

function File(url) {
    this.url = url;
    var m = this.url.match(/(.*)#(.*)-(.*)/);
    if (!m) throw "Invalid URL";
    this.baseServerUrl = m[1];
    this.key = CryptoJS.enc.Hex.parse(m[2]);
    this.fileId = m[3];
    //console.log(this.key);

    var decryptChunk = function(key, data, successCallback) {
	var iv = CryptoJS.lib.WordArray.create(CryptoJS.SHA512(key).words.slice(0,4));
	return CryptoJS.AES.decrypt(data, key, { iv: iv });
        //var aesDecryptor = CryptoJS.algo.AES.createDecryptor(key, { iv: iv });
	//return aesDecryptor.process(CryptoJS.enc.Base64.parse(data)) + aesDecryptor.finalize();
    }
    var downloadRawChunk = function (serverUrl, chunkId, successCallback) {
	var xhr = new XMLHttpRequest();
	xhr.open('GET', serverUrl+"?chunk="+chunkId, true);
	//xhr.responseType = 'arraybuffer';
	xhr.onload = function(e) {
	    //var data = new Uint8Array(this.response);
	    successCallback(this.response);
	};
	xhr.send();
    }
    var downloadChunk = function (key, serverUrl, chunkId, successCallback) {
	downloadRawChunk(serverUrl, chunkId, function (data) {
	    successCallback(decryptChunk(key, data));
	});
    }
    var downloadChunkByUrl = function (key, url, successCallback) {
	var m = url.match(/(.*)\?(.*)/);
	if (!m) throw "Invalid URL";
	var serverUrl = m[1];
	var chunkId = m[2];
	downloadChunk(key, serverUrl, chunkId, successCallback);
    }

    this.downloadMetaData = function (successCallback) {
	downloadChunk(this.key, this.baseServerUrl, this.fileId, function (data) {
	    var metadata = CryptoJS.enc.Latin1.stringify(data);
	    console.log(data, metadata);
	    var m = metadata.match(/(.*)\|(.*)/);
	    // TODO handle multichunk metadata
	    var filename = m[1];
	    var chunks = m[2].split(',');
	    console.log("META", filename, chunks);
	    successCallback(filename, chunks);
	});
    }
    this.download = function () {
	var key = this.key;
	this.downloadMetaData(function (filename, chunks) {
	    CHUNK_SIZE = 32*1024 - 16;
	    // TODO: error handling
	    window.requestFileSystem(window.TEMPORARY, chunks.length * CHUNK_SIZE, function (fs) {
		fs.root.getFile(filename, {create: true}, function(fileEntry) {
		    fileEntry.createWriter(function(writer) {
			var cnt = chunks.length;
			writer.truncate(chunks.length * CHUNK_SIZE);
			for (var i=0;i<chunks.length;i++) {
			    downloadChunkByUrl(key, chunks[i], function (data) {
				writer.seek(i*CHUNK_SIZE);
				writer.write(new Blob([CryptoJS.enc.Latin1.stringify(data)]));
				cnt--;
				if (cnt==0) {
				    var a = document.querySelector('#download-link');
				    a.href = fileEntry.toURL();
				    a.download = filename;
				}
			    });
			}
		    });
		});
	    });
		
	});
    }
}		    

form.onsubmit = function () {
    var url = form['url'].value;
    var file = new File(url);
    try {
	file.download();
    } catch (e) {
	alert(e);
    }
    return false;
};    

//})();