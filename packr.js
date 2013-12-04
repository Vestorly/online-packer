// global vars and functions
messageStream = new Meteor.Stream('message');
sendMessage = function(message) {
  messageStream.emit('message', message);  
};


if (Meteor.isClient) {  
  Session.set('messages', []);

  Template.form.events({
    'submit form' : function (e) {
      // template data, if any, is available in 'this'
        e.preventDefault();

        var timestamp = +new Date;
        
        var $form = $('form');
        var $input = $form.find('input[name="url"]');
        if($input.val().length == 0) 
          $input.val('vestorly.com');
        Meteor.call('scrape', $input.val(), timestamp, function(err){          
        });        
        Meteor.call('webshot', $input.val(), timestamp, function(err){
        });
      }
  });

  // bind our session messages to the output window
  Template.output.messages = function() {
    return Session.get('messages');
  }

  // print to output window for any emitted message
  messageStream.on('message', function(message) {
     var msgs = Session.get('messages');
     msgs.push(message);
     Session.set('messages', msgs);
  });  

  messageStream.on('screenshot', function(data) {
    if($('fieldset').css('display') == 'block') {
      $('fieldset, #screenshot-div').animate({
        height: "toggle",
        opacity: "toggle"
      });
    }
    $('#screenshot').attr('src', 'data:image/png;base64, ' + data);
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    var request = Meteor.require('request');
    var fs      = Meteor.require('fs');
    var cheerio = Meteor.require('cheerio');
    var wrench  = Meteor.require('wrench');
    var path    = Meteor.require('path')   
    
    // var base_path = 'http://vestorly.com';

    // var webshot = Meteor.require('webshot');

    // webshot('vestorly.com', 'google.png', function(err) {
    //    // screenshot now saved to google.png
    // });

    // // code to run on server at startup

    // var compressor = Meteor.require('node-minify');
    // var timestamp = +new Date;

    // // prepare directorie    
    // var js_dir_path = 'tmp/js-' + timestamp
    // var css_dir_path = 'tmp/css-' + timestamp
    // var js_files = [];
    // wrench.mkdirSyncRecursive(js_dir_path, 0777);
    // wrench.mkdirSyncRecursive(css_dir_path, 0777);

    // function minify() {
    //   console.log('Minification started...');
    //   console.log(js_files);

    //   new compressor.minify({
    //     type: 'yui-js',
    //     fileIn: js_files,
    //     fileOut: 'main.js',
    //     callback: function(err, min){
    //       console.log('Finish compressing');
    //         console.log(err);
    //         //console.log(min);
    //     }
    //   });
    // }

    // var numFetched = 0;
    // var url = "http://www.vestorly.com";
    // request(url, function(err, resp, body) {
    //   $ = cheerio.load(resp.body);
    //   var scripts = $('script');
    //   console.log('Found ' + scripts.length + ' script tags.');
    //   scripts.each(function(idx, script) { 
    //     var src = $(script).attr('src');
    //     var filename = js_dir_path + '/' + path.basename(src);
    //     numFetched = numFetched + 1;
    //     if(numFetched == scripts.length) {          
    //       //minify();
    //     }
    //     console.log(numFetched);
    //     if(src) {
    //       console.log(filename);  
    //       var req = request(src, function(err, resp, body){
    //         if(!err) {
    //           console.log('pushing file')
    //           js_files.push(filename);
    //           minify();
    //         }
    //       }).pipe(fs.createWriteStream(filename));          
    //     }  // scripts.each
    //   });      

    // }); // request     

  });
}
