require 'sinatra'
require 'optparse'
require 'open-uri'      # included with Ruby; only needed to load HTML from a URL
require 'nokogiri'      # gem install nokogiri   read more at http://nokogiri.org
require 'fileutils'
require 'pathname'
require 'active_support/core_ext/hash'
require "net/http"
require 'uri'

set :server, 'thin'


def determine_path(base_path, url)
  return url if url.include?('http') 
  return URI.parse(base_path).scheme.to_s + ':' +  "#{url}" if url[0..1].include?('//') # check for //
  return URI.parse(base_path).scheme.to_s + '://' + URI.parse(base_path).host + "/#{url}" if Pathname.new(url).absolute? # check for absolute urls ie '/..css'
  
  #return Pathname.new(base_path).dirname.to_s + "/#{url}"
  return base_path + "/#{url}"
end

def directory_size(path)
  path << '/' unless path.end_with?('/')

  raise RuntimeError, "#{path} is not a directory" unless File.directory?(path)

  total_size = 0
  Dir["#{path}**/*"].each do |f|
    total_size += File.size(f) if File.file?(f) && File.size?(f)
  end
  total_size
end

class App < Sinatra::Base
	connections = []

	# get '/stream', :provides => 'text/event-stream' do
	#   stream :keep_open do |out|
	#     connections << out
	#     out.callback { connections.delete(out) }
	#   end
 #  end

	# get '/chat' do

	# 	connections.each { |out| out << "data: #{params[:msg]}\n\n" }
	# 	sleep 2
	# 	connections.each { |out| out << "data: after: #{params[:msg]}\n\n" }
	# 	sleep 2
	# 	connections.each { |out| out << "data: and after: #{params[:msg]}\n\n" }
 #  		204 # response without entity body
	# end

  # get '/api/screenshot' do 
  #   #cmd = 'juicer merge -s ' + js_dir_path + '* -o ' + output_js_filename + ' -i --force'
  #   #   out << "#{cmd}<br/>"
  #   #   system cmd
  # end

  get '/stream', :provides => 'text/event-stream' do
    stream :keep_open do |out|
      puts 'stream initiated...'
      out << "data: It's gonna be legen -\n"
      sleep 0.5
      out << "data: (wait for it) \n"
      sleep 1
      out << "data:- dary!\n"

      204
    end
  end

	get '/api/parse', :provides => 'text/event-stream' do
    #content_type 'text/event-stream'

    puts 'Begin parsing...'

     options = { 
      excludes: [],
      outputjs: 'main.js',
      outputcss: 'main.js',
      url: '',
      base_path: nil,
    }

    params.each do |key,val|        
      options[key.to_sym] = val unless val && val.blank? 
    end       

    puts options

    stream :keep_open do |out|

      url = options[:url]
      url = 'http://' + url unless url.include?('http')

      out << "Opening #{url}..."      
 
    begin
      html = open(url)              # Get the HTML source string
    rescue
      out << '<br/><span class="label label-danger">Failed to open URL.</span>'
    else      
        doc = Nokogiri.HTML(html)   
        out << "...and done.<br/>"      

        scripts = doc.css('script')                            
        styles = doc.css('link')                             

        total_scripts = scripts.size
        total_styles = styles.size
        out << "Total script tags found: #{total_scripts}. Total link tags found: #{total_styles}<br/>"

        total_fails = 0

        base_path = options[:base_path] || url
        out << "Computed base path: #{base_path}<br/>"

        js_dir_path = 'tmp/js-' + Time.now.to_i.to_s
        css_dir_path = 'tmp/css-' + Time.now.to_i.to_s
        scrshot_path = '/packs/' + Time.now.to_i.to_s
        output_dir_path = 'public/packs/' + Time.now.to_i.to_s

        #FileUtils.rm_rf(Dir.glob('tmp/*'))
        FileUtils.mkdir js_dir_path
        FileUtils.mkdir css_dir_path
        FileUtils.mkdir output_dir_path

        # take a screenshot
        out << "Generating screenshot...<br/>"
        cmd = "phantomjs rasterize.js #{url} #{output_dir_path}/scr.png"
        system cmd

        
        puts "<script>if($('#screenshot-div').css('display') != 'block'){$('#screenshot').attr('src', '#{scrshot_path}/scr.png');$('#screenshot-div').animate({height: 'toggle',opacity: 'toggle'});}</script>"
        out << "<script>if($('#screenshot-div').css('display') == 'block'){$('#screenshot').attr('src', '#{scrshot_path}/scr.png');$('#screenshot-div').animate({height: 'toggle',opacity: 'toggle'});}</script>"        

        scripts.each_with_index do |script, index|
          next if script['src'].nil?
          path = determine_path(base_path, script['src'])
          
          #out << "data:Found #{path}...\n"

          basename = Pathname.new(path).basename.to_s
          filename = js_dir_path + "/#{"%03d" % index}"  
          next if options[:excludes].select{|s| basename.include?(s)}.size > 0
          next unless basename.include? '.js'

          begin       
            out << "Fetching #{path}..."
            open(filename, 'wb') do |file|
              file << open(path).read
              out << "...done <br/>"
            end
          rescue
            out << "...failed! <br/>"
            total_fails = total_fails + 1
            FileUtils.rm(filename)    
          end
        end      

        out << '<hr/>Now retrieving css files...<br/>'
        # pack styles      
        styles.each_with_index do |style, index|
          next if style['href'].nil?
          path = determine_path(base_path, style['href'])
          
          basename = Pathname.new(path).basename.to_s
          filename = css_dir_path + "/#{"%03d" % index}"  
          next if options[:excludes].select{|s| basename.include?(s)}.size > 0
          next unless basename.include? '.css'

          begin       
            out << "Fetching #{path}..."
            open(filename, 'wb') do |file|
              file << open(path).read
              out << "...done <br/>"
            end
          rescue
            out << "...failed! <br/>"
            total_fails = total_fails + 1
            FileUtils.rm(filename)    
          end
        end

        total_js_size = directory_size(js_dir_path)
        total_css_size = directory_size(css_dir_path)
        out << 'Total Javascript files size: ' + total_js_size.to_s + '<br/>'
        out << 'Total CSS files size: ' + total_css_size.to_s + '<br/>'

        out << "Packing...<br/>"

        # pack js files
        # unless (Dir.entries(js_dir_path) - %w{ . .. }).empty?
        #   output_js_filename = output_dir_path + '/' + options[:outputjs]      
        #   cmd = 'juicer merge -s ' + js_dir_path + '* -o ' + output_js_filename + ' -i --force'
        #   out << "#{cmd}<br/>"
        #   system cmd

        #   total_js_size_new = File.size(output_js_filename)
        #   total_js_size_pct_saved = ((total_js_size - total_js_size_new).to_f / total_js_size.to_f) * 100.0
        #   out << 'Packed main.js size: ' + total_js_size_new.to_s + " Total saved: #{total_js_size_pct_saved.round(0)}%"
        # else
        #   out << 'No Javascript files were fetched. <br/>'
        # end

        out << "<br/>Finish!<br/>"
      end
      
      puts '...End'
      204
    end  
	end
end