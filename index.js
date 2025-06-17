const formatConverter = {
  id: 'formatConverter',
  name: 'Format Converter',
  version: '1.0.0',
  description: 'use formatConverter functions',
  author: 'Downlodr',
  
  menuItemIds: [],
  taskBarItemIds: [],

  /**
   * Plugin initialization
   */
  async initialize(api) {
    this.api = api;
    
    // Register menu item for format conversion
    const menuItemId = api.ui.registerMenuItem({
      id: 'format-converter',
      label: 'Convert Format',
      icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 8C14 6.4087 13.3679 4.88258 12.2426 3.75736C11.1174 2.63214 9.5913 2 8 2C6.32263 2.00631 4.71265 2.66082 3.50667 3.82667L2 5.33333M2 5.33333V2M2 5.33333H5.33333M2 8C2 9.5913 2.63214 11.1174 3.75736 12.2426C4.88258 13.3679 6.4087 14 8 14C9.67737 13.9937 11.2874 13.3392 12.4933 12.1733L14 10.6667M14 10.6667H10.6667M14 10.6667V14" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      context: 'download',
      onClick: (contextData) => this.showFormatSelector(contextData)
    });
    
    this.menuItemIds = [menuItemId];

    const taskbarItemId = api.ui.registerTaskBarItem({
      id: 'format-converter',
      label: 'Convert Format',
      icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 8C14 6.4087 13.3679 4.88258 12.2426 3.75736C11.1174 2.63214 9.5913 2 8 2C6.32263 2.00631 4.71265 2.66082 3.50667 3.82667L2 5.33333M2 5.33333V2M2 5.33333H5.33333M2 8C2 9.5913 2.63214 11.1174 3.75736 12.2426C4.88258 13.3679 6.4087 14 8 14C9.67737 13.9937 11.2874 13.3392 12.4933 12.1733L14 10.6667M14 10.6667H10.6667M14 10.6667V14" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      context: 'download',
      onClick: (contextData) => this.showFormatSelector(contextData)
    });
    
    this.taskBarItemIds.push(taskbarItemId);
  },

  /**
   * Show format selection dialog
   */
  async showFormatSelector(contextData) {
    try {
      // Normalize contextData to array format
      let downloadItems = [];
      
      if (Array.isArray(contextData)) {
        // Process array from taskbar selection
        downloadItems = contextData.map(item => {
          if (item.id) {
            return {
              videoUrl: item.id.videoUrl,
              location: item.id.location,
              name: this.extractNameFromLocation(item.id.location)
            };
          }
          return null;
        }).filter(item => item !== null);
      } else {
        // Process single item from menu
        if (contextData && contextData.videoUrl) {
          downloadItems = [{
            videoUrl: contextData.videoUrl,
            location: contextData.location,
            name: contextData.name || this.extractNameFromLocation(contextData.location)
          }];
        }
      }
      
      // Check if we have valid items to process
      if (downloadItems.length === 0) {
        console.error('No valid download items found in context data', contextData);
        this.api.ui.showNotification({
          title: 'Error',
          message: 'No valid downloads selected',
          type: 'error',
          duration: 3000
        });
        return;
      }
      
      // Assign a unique id to each download item (use location+name as a fallback if id is missing)
      const downloadItemsWithId = downloadItems.map((item, idx) => ({
        ...item,
        id: item.id || `${item.location}__${item.name}__${idx}`
      }));

      // Show format selector
      const formatResult = await this.api.ui.showFormatSelector({
        title: "Choose Format to Convert",
        formats: [
          { id: "mp3", label: "MP3 (Audio)", value: "mp3", default: true },
          { id: "mp4", label: "MP4 (Video)", value: "mp4", default: false },
          { id: "webm", label: "WebM (Video)", value: "webm", default: false },
          { id: "mkv", label: "MKV (Video)", value: "mkv", default: false },
          { id: "m4a", label: "M4A (Audio)", value: "m4a", default: false }
        ],
        keepOriginal: false,
        selectedItems: downloadItemsWithId.map(item => ({
          id: item.id,
          name: item.name,
          selected: true
        })),
        showItemSelection: true,
        showSelectAll: true,
        selectAllDefault: true,
        confirmButtonText: "Convert Selected",
        cancelButtonText: "Cancel"
      });
      
      // User cancelled selection
      if (!formatResult) return;
      
      const { selectedFormat, keepOriginal, selectedItems } = formatResult;
      console.log(`Selected format: ${selectedFormat}, Keep original: ${keepOriginal}`);
      
      // Filter download items based on user selection (use id, not videoUrl)
      const itemsToConvert = downloadItemsWithId.filter(item => 
        selectedItems.find(selected => selected.id === item.id)?.selected
      );
      
      // Process each selected download item
      for (const item of itemsToConvert) {
        await this.handleUseYTDLP(item, selectedFormat);
      }
    } catch (error) {
      console.error('Error showing format selector:', error);
      this.api.ui.showNotification({
        title: 'Error',
        message: 'Failed to show format selector',
        type: 'error',
        duration: 3000
      });
    }
  },

  /**
   * Get filename from path
   */
  extractNameFromLocation(location) {
    if (!location) return 'download';
    const parts = location.split(/[\/\\]/);
    const filename = parts[parts.length - 1];
    return filename || 'download';
  },

  /**
   * File path utilities
   */
  pathUtils: {
    getExtension(filename) {
      return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
    },
    
    getBaseName(filename) {
      const lastDot = filename.lastIndexOf('.');
      return lastDot === -1 ? filename : filename.substring(0, lastDot);
    },
    
    getDirPath(fullPath) {
      const lastSlash = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
      return lastSlash === -1 ? '' : fullPath.substring(0, lastSlash);
    }
  },

  /**
   * Generate audio format options based on available formats
   */
  createAudioOptions(audioOnlyFormat) {
    if (!audioOnlyFormat) return [{
      value: 'audio-0-mp3',
      label: 'Audio Only (mp3)',
      formatId: '0',
      fileExtension: 'mp3',
    }];

    return [
      {
        value: `audio-${audioOnlyFormat.format_id}-${audioOnlyFormat.audio_ext || audioOnlyFormat.ext}`,
        label: `Audio Only (${audioOnlyFormat.audio_ext || audioOnlyFormat.ext}) - ${
          audioOnlyFormat.format_note || audioOnlyFormat.ext
        }`,
        formatId: audioOnlyFormat.format_id,
        fileExtension: audioOnlyFormat.audio_ext || audioOnlyFormat.ext,
      },
      {
        value: `audio-${audioOnlyFormat.format_id}-mp3`,
        label: `Audio Only (mp3) - ${
          audioOnlyFormat.format_note || audioOnlyFormat.ext
        }`,
        formatId: audioOnlyFormat.format_id,
        fileExtension: 'mp3',
      },
    ];
  },

  /**
   * Find best format options for different format types
   */
  processVideoFormats(info) {
    const formatsArray = info.data.formats || [];
    const extractorKey = info.data.extractor_key;
    
    // Find best audio-only format
    const audioOnlyFormat = formatsArray.find(format => 
      (format.vcodec === 'none' && format.format && format.format.includes('audio only')) ||
      format.resolution === 'audio only' ||
      (format.vcodec === 'none' && format.acodec !== 'none')
    );
    
    // Create audio options
    const audioOptions = this.createAudioOptions(audioOnlyFormat);
    
    // Process formats based on extractor (platform)
    let formatOptions = [];
    const audioFormatId = audioOnlyFormat ? audioOnlyFormat.format_id : '0';
    
    if (extractorKey === 'Youtube') {
      // YouTube logic (audio+video format)
      const formatMap = new Map();
      const seenCombinations = new Set();
      
      formatsArray.forEach(format => {
        const resolution = format.resolution;
        const formatId = format.format_id;
        let video_ext = format.video_ext || format.ext;
        const url = format.url;
        const format_note = format.format_note || resolution;
        
        if (!resolution || !video_ext || video_ext === 'none' || !url) return;
        
        const combinationKey = `${video_ext}-${format_note}`;
        
        if (!seenCombinations.has(combinationKey)) {
          seenCombinations.add(combinationKey);
          formatMap.set(formatId, { formatId, video_ext, format_note });
        }
      });
      
      formatOptions = Array.from(formatMap.entries())
        .flatMap(([_, formatInfo]) => [{
          value: `${formatInfo.video_ext}-${formatInfo.format_note}`,
          label: `${formatInfo.video_ext} - ${formatInfo.format_note}`,
          formatId: `${audioFormatId}+${formatInfo.formatId}`,
          fileExtension: formatInfo.video_ext,
        }])
        .reverse();
    } else {
      // Default logic for other platforms
      const formatMap = new Map();
      const seenCombinations = new Set();
      
      formatsArray.forEach(format => {
        const resolution = format.resolution || format.format_id;
        const formatId = format.format_id;
        const video_ext = format.ext;
        const url = format.url;
        const format_note = format.format_note || resolution || formatId;
        
        if (!video_ext || !url || (format_note && format_note.includes('DASH'))) return;
        
        const combinationKey = `${video_ext}-${resolution}`;
        
        if (!seenCombinations.has(combinationKey)) {
          seenCombinations.add(combinationKey);
          formatMap.set(formatId, { formatId, video_ext, format_note, resolution });
        }
      });
      
      formatOptions = Array.from(formatMap.entries())
        .flatMap(([_, formatInfo]) => {
          // For non-YouTube, some formats use direct formatId, others use combined format
          const formatIdToUse = ['Vimeo', 'BiliBili', 'CNN'].includes(extractorKey)
            ? `${audioFormatId}+${formatInfo.formatId}`
            : formatInfo.formatId;
            
          return [{
            value: `${formatInfo.video_ext}-${formatInfo.resolution}`,
            label: `${formatInfo.video_ext} - ${formatInfo.resolution}`,
            formatId: formatIdToUse,
            fileExtension: formatInfo.video_ext,
          }];
        })
        .reverse();
    }
    
    return {
      formatOptions,
      audioOptions,
      defaultFormatId: formatOptions[0]?.formatId || '',
      defaultExt: formatOptions[0]?.fileExtension || 'mp4'
    };
  },

  /**
   * Check if extension is audio
   */
  isAudioFormat(ext) {
    const audioExtensions = ['mp3', 'ogg', 'm4a', 'wav', 'flac', 'aac'];
    return audioExtensions.includes(ext.toLowerCase());
  },

  /**
   * Convert video to requested format
   */
  async handleUseYTDLP(contextData, requestedExt){
    try{
      if(!contextData || !contextData.videoUrl){
        console.log('Invalid context data:', contextData);
        this.api.ui.showNotification({
          title: 'Failed to convert format',
          message: `Error: plugin failed to receive data`,
          type: 'destructive',
          duration: 3000
        });
        return;
      }
      
      console.log("handleUseYTDLP called with extension:", requestedExt);
      
      // Default to mp3
      requestedExt = requestedExt || 'mp3';
      console.log("Final requestedExt:", requestedExt);
      
      this.api.ui.showNotification({ 
        title: 'Converting Format',
        message: `Converting format to ${requestedExt}`,
        type: 'default',
        duration: 3000
      });

      const videoInfo = await this.api.downloads.getInfo(contextData.videoUrl);
      
      // Get output directory
      const directoryPath = contextData.location.replace(/[\/\\][^\/\\]*$/, '');
      // Store in FormatConverter subfolder
      const finalDirectoryPath = `${directoryPath}/FormatConverter/`;
      
      // Create output filename
      const baseName = contextData.name.replace(/\.[^/.]+$/, "");
      const fileName = baseName.startsWith('🎞️') ? `${baseName}.${requestedExt}` : `🎞️ ${baseName}.${requestedExt}`;
      let downloadOptions = {};
      
      // Setup options based on audio or video format
      if (this.isAudioFormat(requestedExt)) {
        // Find best audio format option
        const processedFormats = this.processVideoFormats(videoInfo);
        
        const audioOption = processedFormats.audioOptions.find(option => 
          option.fileExtension === requestedExt
        ) || processedFormats.audioOptions[0];
        
        const formatId = audioOption ? audioOption.formatId : '0';
        console.log("Selected audio formatId:", formatId);
        
        // Audio download config
        downloadOptions = {
          name: fileName,
          downloadName: fileName,
          size: 0,
          speed: '',
          timeLeft: '',
          location: finalDirectoryPath,
          ext: '',                    
          formatId: '',               
          audioExt: requestedExt,     
          audioFormatId: formatId,    
          extractorKey: videoInfo.data.extractor_key,
          limitRate: '',
          automaticCaption: null,
          thumbnails: null,
          getTranscript: false,
          getThumbnail: false
        };
      } else {
        // Video download config
        console.log("Using default video formatId:", videoInfo.data.format_id);
        
        downloadOptions = {
          name: fileName,
          downloadName: fileName,
          size: 0,
          speed: '',
          timeLeft: '',
          location: finalDirectoryPath,
          ext: requestedExt,           
          formatId: videoInfo.data.format_id, 
          audioExt: '',                
          audioFormatId: '',           
          extractorKey: videoInfo.data.extractor_key,
          limitRate: '',
          automaticCaption: null,
          thumbnails: null,
          getTranscript: false,
          getThumbnail: false,
          duration: videoInfo.duration,
        };
      }
      
      console.log("Final download options:", JSON.stringify(downloadOptions, null, 2));
      
      // Start the conversion download
      await this.api.downloads.addDownload(contextData.videoUrl, downloadOptions);
      
      this.api.ui.showNotification({
        title: 'Conversion Started',
        message: `Converting to ${requestedExt}: ${baseName}`,
        type: 'default',
        duration: 3000
      });

    } catch(error) {
      console.error("Conversion error:", error);
      this.api.ui.showNotification({
        title: 'Failed to convert format',
        message: `Error: ${error.message || error}`,
        type: 'destructive',
        duration: 3000
      });
      return;
    }
  }
};

module.exports = formatConverter;