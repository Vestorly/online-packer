
Meteor.methods({
  webshot: function (url, timestamp) {
    //check(arg1, String);
    //check(arg2, [Number]);
    // .. do stuff ..
    //if (you want to throw an error)
    //  throw new Meteor.Error(404, "Can't find my pants");
    var webshot = Meteor.require('webshot');
    var wrench  = Meteor.require('wrench');

    var filename = url + '.png';
    webshot(url, function(err, renderStream) {      
      
      //messageStream.emit('moveFile', filename);       

      // move files to uploads folder
      var currentPath = process.cwd();

      var fs        = Meteor.require('fs');
      var timestampPath = Meteor.settings.tmpPath + '/' + timestamp;
      var finalPath = timestampPath + '/' + filename;
      wrench.mkdirSyncRecursive(timestampPath, 0777);      

      var file = fs.createWriteStream(finalPath, {encoding: 'binary'});

      //console.log(renderStream.constructor.toString());
      renderStream.on('data', function(data) {
        //console.log(data.toString('base64'));
        //console.log(data.toString('binary'));
        file.write(data.toString('binary'), 'binary');
        //sendMessage(data.length);  
      });

      renderStream.on('end', function() {
        sendMessage('...finished taking screenshot.');       

        fs.readFile(finalPath, 'base64', function(err, data) {
          messageStream.emit('screenshot', data.toString('base64'));
        });
      });

      //var fs = Meteor.require('fs');
      //fs.rename(current_path + '/' + filename, public_path + '/' + filename);

    });    

    sendMessage('Taking screenshot of ' + url);                
  },

  scrape: function(url, timestamp) {
    sendMessage('Scraping ' + url);

    var request = Meteor.require('request');
    var fs      = Meteor.require('fs');
    var cheerio = Meteor.require('cheerio');
    var wrench  = Meteor.require('wrench');
    var path    = Meteor.require('path')   
    var compressor = Meteor.require('node-minify');
    
    var base_path = url;            

    // prepare directorie    
    var js_dir_path = Meteor.settings.tmpPath + '/' + timestamp  + '/js';
    var css_dir_path = Meteor.settings.tmpPath + '/' + timestamp + '/css';
    var js_files = [];
    wrench.mkdirSyncRecursive(js_dir_path, 0777);
    wrench.mkdirSyncRecursive(css_dir_path, 0777);

    function minify() {
      sendMessage('Minification started...');
      console.log(js_files);
      var outputPath = Meteor.settings.wwwPath + '/' + timestamp;
      wrench.mkdirSyncRecursive(outputPath, 0777);

      new compressor.minify({
        type: 'gcc',
        fileIn: js_files,
        fileOut: outputPath + '/main.js',
        callback: function(err, min){
          if(!err) {
            sendMessage('Finish compressing');
            sendMessage('Download here: <a href="' + Meteor.settings.baseDownloadUrl + '/' + timestamp + '/main.js' + '" target="_blank">here</a>')
             //console.log(min);
          } else {
            sendMessage('There has been a problem with the minification process.');
            console.log(err);
          }
        }
      });
    }

    var numFetched = 0;    
    request('http://' + url, function(err, resp, body) {
      $ = cheerio.load(resp.body);
      var scripts = $('script');
      sendMessage('Found ' + scripts.length + ' script tags.');
      
      // loop through all scripts
      scripts.each(function(idx, script) { 
        var src = $(script).attr('src');
        var filename = js_dir_path + '/' + path.basename(src);        
        //sendMessage(numFetched);
        if(src) {          
          var req = request(src, function(err, resp, body){   
            numFetched = numFetched + 1;                 

            if(!err) {
              sendMessage('Pulled ' + src + '... ' + body.length + ' bytes');  
              js_files.push(filename);
              //minify();
            } else {
              console.log(err);
              sendMessage(err);
            }

            if(numFetched == scripts.length) {          
              minify();
            }

          }).pipe(fs.createWriteStream(filename));          
        } else {
          numFetched = numFetched + 1;  
        }         
      });  // scripts.each    

    }); // request     
  }
});
