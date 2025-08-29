const formatConverter = {
  id: 'formatConverter',
  name: 'Format Converter',
  version: '1.0.9',
  description: 'use formatConverter functions',
  author: 'Downlodr',

  menuItemIds: [],
  taskBarItemIds: [],

  isPaused: false,
  isProcessing: false,

  downloadItems: [],

  queueKey: 'formatConverter_queue',
  formatKey: 'formatConverter_format',

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
      onClick: (contextData) => this.showFormatSelector(contextData),
    });

    this.menuItemIds = [menuItemId];

    const taskBarItemIds = await api.ui.getTaskBarItems();
    const isButtonRegistered = taskBarItemIds.find(
      (item) => item.id === 'format-converter'
    );

    const taskbarItemId = await api.ui.registerTaskBarItem({
      id: 'format-converter',
      label: 'Convert Format',
      icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 8C14 6.4087 13.3679 4.88258 12.2426 3.75736C11.1174 2.63214 9.5913 2 8 2C6.32263 2.00631 4.71265 2.66082 3.50667 3.82667L2 5.33333M2 5.33333V2M2 5.33333H5.33333M2 8C2 9.5913 2.63214 11.1174 3.75736 12.2426C4.88258 13.3679 6.4087 14 8 14C9.67737 13.9937 11.2874 13.3392 12.4933 12.1733L14 10.6667M14 10.6667H10.6667M14 10.6667V14" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      iconStyle: { marginTop: '2px' },
      buttonStyle: {
        display:
          isButtonRegistered && taskBarItemIds.length > 0 ? 'none' : 'flex',
      },
      context: 'download',
      onClick: (contextData) => this.showFormatSelector(contextData),
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
        downloadItems = contextData
          .map((item) => {
            if (item.id) {
              return {
                videoUrl: item.id.videoUrl,
                location: item.id.location,
                name: this.extractNameFromLocation(item.id.location),
              };
            }
            return null;
          })
          .filter((item) => item !== null);
      } else {
        // Process single item from menu
        if (contextData && contextData.videoUrl) {
          downloadItems = [
            {
              videoUrl: contextData.videoUrl,
              location: contextData.location,
              name:
                contextData.name ||
                this.extractNameFromLocation(contextData.location),
            },
          ];
        }
      }

      // Check if we have valid items to process
      if (downloadItems.length === 0) {
        console.error(
          'No valid download items found in context data',
          contextData
        );
        this.api.ui.showNotification({
          title: 'Error',
          message: 'No valid downloads selected',
          type: 'error',
          duration: 3000,
        });
        return;
      }

      // Assign a unique id to each download item (use location+name as a fallback if id is missing)
      const downloadItemsWithId = downloadItems.map((item, idx) => ({
        ...item,
        id: item.id || `${item.location}__${item.name}__${idx}`,
      }));
      console.log(contextData.osType);
      // Detect operating system and prepare format list
      const isDarwin = contextData.osType==='macos';
      console.log(isDarwin);
      
      // Base formats array
      let availableFormats = [
        { id: 'mp3', label: 'MP3 (Audio)', value: 'mp3', default: true },
        { id: 'mp4', label: 'MP4 (Video)', value: 'mp4', default: false },
        { id: 'mkv', label: 'MKV (Video)', value: 'mkv', default: false },
        { id: 'm4a', label: 'M4A (Audio)', value: 'm4a', default: false },
      ];

      // Add WebM format only if not on Darwin (macOS)
      if (!isDarwin) {
        availableFormats.splice(2, 0, { id: 'webm', label: 'WebM (Video)', value: 'webm', default: false });
      }

      // Show format selector
      const formatResult = await this.api.ui.showFormatSelector({
        title: `Choose Format to Convert - ${contextData.osType}`,
        formats: availableFormats,
        keepOriginal: false,
        selectedItems: downloadItemsWithId.map((item) => ({
          id: item.id,
          name: item.name,
          selected: true,
        })),
        showItemSelection: true,
        showSelectAll: true,
        selectAllDefault: true,
        confirmButtonText: 'Convert Selected',
        cancelButtonText: 'Cancel',
      });

      // User cancelled selection
      if (!formatResult) return;

      const { selectedFormat, keepOriginal, selectedItems } = formatResult;
      console.log(
        `Selected format: ${selectedFormat}, Keep original: ${keepOriginal}`
      );

      // Filter download items based on user selection (use id, not videoUrl)
      const itemsToConvert = downloadItemsWithId.filter(
        (item) =>
          selectedItems.find((selected) => selected.id === item.id)?.selected
      );

      // Store conversion queue in session storage
      let existingQueue = JSON.parse(
        sessionStorage.getItem(this.queueKey) || '[]'
      );
      existingQueue = [...existingQueue, ...itemsToConvert];
      sessionStorage.setItem(this.queueKey, JSON.stringify(existingQueue));
      sessionStorage.setItem(this.formatKey, selectedFormat);

      // Start processing if there are items to convert
      if (itemsToConvert.length > 0) {
        this.isProcessing = true;
        this.isPaused = false;
        this.api.ui.showNotification({
          title: 'Starting Conversion',
          message: `Processing first batch of ${Math.min(
            5,
            itemsToConvert.length
          )} items`,
          type: 'default',
          duration: 3000,
        });
        await this.processBatch();
      }

      // Replace task bar buttons if there are multiple conversions
      if (itemsToConvert.length > 1) {
        let buttonsReplaced = false;

        const interval = setInterval(async () => {
          const activeDownloads = this.api.downloads.getActiveDownloads();

          // Check first if the download has started to replace the task bar buttons
          if (!buttonsReplaced && activeDownloads.length > 1) {
            await this.replaceTaskBarButtons(itemsToConvert);
            buttonsReplaced = true;
          }

          // Then, check if all conversions are complete to reset the task bar buttons
          if (buttonsReplaced && activeDownloads.length === 0) {
            await this.resetTaskBarButtons();
            await this.cleanupState();
            clearInterval(interval);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error showing format selector:', error);
      this.api.ui.showNotification({
        title: 'Error',
        message: 'Failed to show format selector',
        type: 'error',
        duration: 3000,
      });

      this.api.ui.setTaskBarButtonsVisibility({
        start: true,
        stop: true,
        stopAll: true,
      });
    }
  },

  /**
   * Replace the task bar buttons with the conversion status, pause, resume, and stop buttons
   */
  async replaceTaskBarButtons() {
    this.api.ui.setTaskBarButtonsVisibility({
      start: false,
      stop: false,
      stopAll: false,
    });

    const getStatusText = () => {
      return `Converting ${this.downloadItems.length} files`;
    };

    const conversionStatusItemId = await this.api.ui.registerTaskBarItem({
      id: 'format-converter-status',
      label: getStatusText(),
      context: 'download',
      buttonStyle: {
        backgroundColor: '#EFF6FF',
        color: '#1E3A8A',
        pointerEvents: 'none',
        borderRadius: '20px',
      },
      labelStyle: { color: '#1E3A8A', fontSize: '12px' },
    });

    const resumeTaskBarItemId = await this.api.ui.registerTaskBarItem({
      id: 'format-converter-resume',
      label: 'Resume',
      icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clip-path="url(#clip0_3130_147)">
      <path d="M8.00065 14.6673C11.6825 14.6673 14.6673 11.6825 14.6673 8.00065C14.6673 4.31875 11.6825 1.33398 8.00065 1.33398C4.31875 1.33398 1.33398 4.31875 1.33398 8.00065C1.33398 11.6825 4.31875 14.6673 8.00065 14.6673Z"  stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M6.66732 5.33398L10.6673 8.00065L6.66732 10.6673V5.33398Z"  stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <defs>
      <clipPath id="clip0_3130_147">
      <rect width="16" height="16" fill="white"/>
      </clipPath>
      </defs>
      </svg>
      `,
      context: 'download',
      buttonStyle: {
        border: '1px solid #D1D5DB',
        cursor: this.isPaused ? 'pointer' : 'not-allowed',
        opacity: this.isPaused ? 1 : 0.5,
        pointerEvents: this.isPaused ? 'auto' : 'none',
      },
      iconStyle: { marginTop: '2px' },
      labelStyle: { fontSize: '12px' },
      actionType: 'multiple',
      onClick: (contextData) => this.handleResume(contextData),
    });

    const pauseTaskbarItemId = await this.api.ui.registerTaskBarItem({
      id: 'format-converter-pause',
      label: 'Pause',
      icon: `<svg width="10" height="14" viewBox="0 0 10 14" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3.66667 1.66797H1V12.3346H3.66667V1.66797Z"  stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9 1.66797H6.33333V12.3346H9V1.66797Z"  stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
      context: 'download',
      buttonStyle: {
        border: '1px solid #D1D5DB',
        cursor: !this.isPaused ? 'pointer' : 'not-allowed',
        opacity: !this.isPaused ? 1 : 0.5,
        pointerEvents: !this.isPaused ? 'auto' : 'none',
      },
      iconStyle: { marginTop: '2px' },
      labelStyle: { fontSize: '12px' },
      actionType: 'multiple',
      onClick: (contextData) => this.handlePause(contextData),
    });

    const stopTaskbarItemId = await this.api.ui.registerTaskBarItem({
      id: 'format-converter-stop',
      label: 'Stop All',
      icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M8.0026 14.6654C11.6845 14.6654 14.6693 11.6806 14.6693 7.9987C14.6693 4.3168 11.6845 1.33203 8.0026 1.33203C4.32071 1.33203 1.33594 4.3168 1.33594 7.9987C1.33594 11.6806 4.32071 14.6654 8.0026 14.6654Z"  stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M10.0026 5.9987H6.0026V9.9987H10.0026V5.9987Z"  stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
      context: 'download',
      buttonStyle: { border: '1px solid #D1D5DB' },
      iconStyle: { marginTop: '2px' },
      labelStyle: { fontSize: '12px' },
      actionType: 'multiple',
      onClick: (contextData) => this.handleStop(contextData),
    });

    this.taskBarItemIds.push(
      conversionStatusItemId,
      pauseTaskbarItemId,
      resumeTaskBarItemId,
      stopTaskbarItemId
    );

    await window.plugins.reload();
  },

  /**
   * Reset the task bar buttons to the default state
   */
  async resetTaskBarButtons() {
    await this.api.ui.unregisterTaskBarItem('format-converter');
    this.api.ui.unregisterTaskBarItem('format-converter-status');
    this.api.ui.unregisterTaskBarItem('format-converter-pause');
    this.api.ui.unregisterTaskBarItem('format-converter-resume');
    this.api.ui.unregisterTaskBarItem('format-converter-stop');

    await window.plugins.reload();

    this.api.ui.setTaskBarButtonsVisibility({
      start: true,
      stop: true,
      stopAll: true,
    });
  },


/**
 * Resume paused conversions if there are items in the queue
 * Now includes automatic cleanup for problematic formats like m4a
 */
async handleResume(contextData) {
  this.isPaused = false;
  await this.replaceTaskBarButtons();

  const cleanupFormats = ['m4a', 'aac'];

  const result = await this.api.downloads.resumeAllDownloadsWithCleanup(cleanupFormats);

  if (result.success) {
    // success message
    let message = `${result.resumedCount} conversions resumed successfully`;
    
    if (result.cleanupCount > 0) {
      message += `. Cleaned up ${result.cleanupCount} corrupted file(s)`;
    }

    this.api.ui.showNotification({
      title: 'Conversions Resumed',
      message: message,
      type: 'success',
      duration: 3000,
    });
    /*
    console.log('Resume Results:', {
      total: result.totalDownloads,
      resumed: result.resumedCount,
      failed: result.failedCount,
      cleanedUp: result.cleanupCount,
      details: result.results
    });
    */
    // Resume processing the queue if there are items
    if (!this.isProcessing) {
      const queue = JSON.parse(sessionStorage.getItem(this.queueKey) || '[]');
      if (queue.length > 0) {
        this.isProcessing = true;
        await this.processBatch();
      }
    }
  } else {
    let errorMessage = 'An error occurred while resuming conversions';
    
    if (result.cleanupCount > 0) {
      errorMessage += `. ${result.cleanupCount} files were cleaned up, but ${result.failedCount} conversions failed to resume`;
    }

    this.api.ui.showNotification({
      title: 'Failed to Resume Conversions',
      message: errorMessage,
      type: 'error',
      duration: 5000,
    });
  }
},

  /**
   * Pause all ongoing and queued conversions
   */
  async handlePause(contextData) {
    this.isPaused = true;
    this.isProcessing = false;
    await this.replaceTaskBarButtons();

    const result = await this.api.downloads.pauseAllDownloads(contextData);

    if (result.success) {
      this.api.ui.showNotification({
        title: 'Conversion Paused',
        message: `All ongoing conversion processes have been paused`,
        type: 'default',
        duration: 3000,
      });
    } else {
      this.api.ui.showNotification({
        title: 'Failed to pause conversions',
        message: result.error || `An error occurred while pausing conversions`,
        type: 'destructive',
        duration: 3000,
      });
    }
  },

  /**
   * Stop all ongoing and queued conversions
   */
  async handleStop(contextData) {
    const result = await this.api.downloads.stopAllDownloads(contextData);

    if (result) {
      await this.cleanupState();
      this.api.ui.showNotification({
        title: 'Conversion Stopped',
        message: `All ongoing conversion processes have been stopped`,
        type: 'default',
        duration: 3000,
      });
    } else {
      this.api.ui.showNotification({
        title: 'Failed to stop conversions',
        message:
          result?.error || `An error occurred while stopping conversions`,
        type: 'destructive',
        duration: 3000,
      });
    }

    await this.resetTaskBarButtons();
  },

  /**
   * Process conversions in batches of 5
   */
  async processBatch() {
    if (this.isPaused || !this.isProcessing) {
      return;
    }

    const queue = JSON.parse(sessionStorage.getItem(this.queueKey) || '[]');
    const format = sessionStorage.getItem(this.formatKey);

    if (queue.length === 0) {
      await this.cleanupState();
      await this.resetTaskBarButtons();
      return;
    }

    // Take first 5 items
    const currentBatch = queue.slice(0, 5);
    const remainingQueue = queue.slice(5);
    sessionStorage.setItem(this.queueKey, JSON.stringify(remainingQueue));

    // Update status display
    this.downloadItems = currentBatch;
    let buttonsReplaced = false;

    // Process current batch
    for (let index = 0; index < currentBatch.length; index++) {
      if (this.isPaused || !this.isProcessing) {
        return;
      }
      const item = currentBatch[index];
      this.handleUseYTDLP(item, format);
    }

    // Monitor batch completion
    const batchInterval = setInterval(async () => {
      if (this.isPaused || !this.isProcessing) {
        clearInterval(batchInterval);
        return;
      }

      const activeDownloads = this.api.downloads.getActiveDownloads();

      // Replace buttons when downloads start
      if (!buttonsReplaced && activeDownloads.length > 0) {
        await this.replaceTaskBarButtons(currentBatch);
        buttonsReplaced = true;
      }

      // When current batch is complete
      if (buttonsReplaced && activeDownloads.length === 0) {
        clearInterval(batchInterval);

        // Process next batch if there are items remaining
        if (remainingQueue.length > 0 && !this.isPaused && this.isProcessing) {
          this.api.ui.showNotification({
            title: 'Batch Complete',
            message: `Processing next batch of ${Math.min(
              5,
              remainingQueue.length
            )} items`,
            type: 'default',
            duration: 3000,
          });
          await this.processBatch();
        } else if (remainingQueue.length === 0) {
          this.api.ui.showNotification({
            title: 'Conversion Complete',
            message: 'All items have been converted',
            type: 'default',
            duration: 3000,
          });
          await this.cleanupState();
          await this.resetTaskBarButtons();
        }
      }
    }, 1000);
  },

  /**
   * Clean up all states and storage
   */
  async cleanupState() {
    sessionStorage.removeItem(this.queueKey);
    sessionStorage.removeItem(this.formatKey);
    this.isProcessing = false;
    this.downloadItems = [];
    this.isPaused = false;
    this.totalItems = 0;
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
      return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
    },

    getBaseName(filename) {
      const lastDot = filename.lastIndexOf('.');
      return lastDot === -1 ? filename : filename.substring(0, lastDot);
    },

    getDirPath(fullPath) {
      const lastSlash = Math.max(
        fullPath.lastIndexOf('/'),
        fullPath.lastIndexOf('\\')
      );
      return lastSlash === -1 ? '' : fullPath.substring(0, lastSlash);
    },
  },

  /**
   * Generate audio format options based on available formats
   */
  createAudioOptions(audioOnlyFormat) {
    if (!audioOnlyFormat)
      return [
        {
          value: 'audio-0-mp3',
          label: 'Audio Only (mp3)',
          formatId: '0',
          fileExtension: 'mp3',
        },
      ];

    return [
      {
        value: `audio-${audioOnlyFormat.format_id}-${
          audioOnlyFormat.audio_ext || audioOnlyFormat.ext
        }`,
        label: `Audio Only (${
          audioOnlyFormat.audio_ext || audioOnlyFormat.ext
        }) - ${audioOnlyFormat.format_note || audioOnlyFormat.ext}`,
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
    const audioOnlyFormat = formatsArray.find(
      (format) =>
        (format.vcodec === 'none' &&
          format.format &&
          format.format.includes('audio only')) ||
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

      formatsArray.forEach((format) => {
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
        .flatMap(([_, formatInfo]) => [
          {
            value: `${formatInfo.video_ext}-${formatInfo.format_note}`,
            label: `${formatInfo.video_ext} - ${formatInfo.format_note}`,
            formatId: `${audioFormatId}+${formatInfo.formatId}`,
            fileExtension: formatInfo.video_ext,
          },
        ])
        .reverse();
    } else {
      // Default logic for other platforms
      const formatMap = new Map();
      const seenCombinations = new Set();

      formatsArray.forEach((format) => {
        const resolution = format.resolution || format.format_id;
        const formatId = format.format_id;
        const video_ext = format.ext;
        const url = format.url;
        const format_note = format.format_note || resolution || formatId;

        if (!video_ext || !url || (format_note && format_note.includes('DASH')))
          return;

        const combinationKey = `${video_ext}-${resolution}`;

        if (!seenCombinations.has(combinationKey)) {
          seenCombinations.add(combinationKey);
          formatMap.set(formatId, {
            formatId,
            video_ext,
            format_note,
            resolution,
          });
        }
      });

      formatOptions = Array.from(formatMap.entries())
        .flatMap(([_, formatInfo]) => {
          // For non-YouTube, some formats use direct formatId, others use combined format
          const formatIdToUse = ['Vimeo', 'BiliBili', 'CNN'].includes(
            extractorKey
          )
            ? `${audioFormatId}+${formatInfo.formatId}`
            : formatInfo.formatId;

          return [
            {
              value: `${formatInfo.video_ext}-${formatInfo.resolution}`,
              label: `${formatInfo.video_ext} - ${formatInfo.resolution}`,
              formatId: formatIdToUse,
              fileExtension: formatInfo.video_ext,
            },
          ];
        })
        .reverse();
    }

    return {
      formatOptions,
      audioOptions,
      defaultFormatId: formatOptions[0]?.formatId || '',
      defaultExt: formatOptions[0]?.fileExtension || 'mp4',
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
  async handleUseYTDLP(contextData, requestedExt) {
    try {
      if (!contextData || !contextData.videoUrl) {
        console.log('Invalid context data:', contextData);
        this.api.ui.showNotification({
          title: 'Failed to convert format',
          message: `Error: plugin failed to receive data`,
          type: 'destructive',
          duration: 3000,
        });
        return;
      }

      console.log('handleUseYTDLP called with extension:', requestedExt);

      // Default to mp3
      requestedExt = requestedExt || 'mp3';
      console.log('Final requestedExt:', requestedExt);

      this.api.ui.showNotification({
        title: 'Converting Format',
        message: `Converting format to ${requestedExt}`,
        type: 'default',
        duration: 3000,
      });

      const videoInfo = await this.api.downloads.getInfo(contextData.videoUrl);

      // Get output directory
      const directoryPath = contextData.location.replace(/[\/\\][^\/\\]*$/, '');
      // Store in FormatConverter subfolder
      console.log('directoryPath:', contextData.location);
      const finalDirectoryPath = `${contextData.location}/FormatConverter/`;

      // Create output filename
      const baseName = contextData.name.replace(/\.[^/.]+$/, '');
      const fileName = baseName.startsWith('🎞️')
        ? `${baseName}_${requestedExt}.${requestedExt}`
        : `🎞️ ${baseName}_${requestedExt}.${requestedExt}`;
      let downloadOptions = {};

      // Setup options based on audio or video format
      if (this.isAudioFormat(requestedExt)) {
        // Find best audio format option
        const processedFormats = this.processVideoFormats(videoInfo);

        const audioOption =
          processedFormats.audioOptions.find(
            (option) => option.fileExtension === requestedExt
          ) || processedFormats.audioOptions[0];

        const formatId = audioOption ? audioOption.formatId : '0';
        console.log('Selected audio formatId:', formatId);

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
          getThumbnail: false,
        };
      } else {
        // Video download config
        console.log('Using default video formatId:', videoInfo.data.format_id);

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

      console.log(
        'Final download options:',
        JSON.stringify(downloadOptions, null, 2)
      );

      // Start the conversion download
      await this.api.downloads.addDownload(
        contextData.videoUrl,
        downloadOptions
      );

      this.api.ui.showNotification({
        title: 'Conversion Started',
        message: `Converting to ${requestedExt}: ${baseName}`,
        type: 'default',
        duration: 3000,
      });
    } catch (error) {
      console.error('Conversion error:', error);
      this.api.ui.showNotification({
        title: 'Failed to convert format',
        message: `Error: ${error.message || error}`,
        type: 'destructive',
        duration: 3000,
      });
      return;
    }
  },
};

module.exports = formatConverter;
