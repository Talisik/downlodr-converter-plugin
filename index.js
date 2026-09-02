const formatConverter = {
  id: 'formatConverter',
  name: 'Format Converter',
  version: '1.2.1',
  description: 'use formatConverter functions',
  author: 'Downlodr',

  menuItemIds: [],
  taskBarItemIds: [],

  isPaused: false,
  isProcessing: false,

  downloadItems: [],

  queueKey: 'formatConverter_queue',
  formatKey: 'formatConverter_format',

  // jobIds of ffmpeg conversions currently in flight (spawned, not yet
  // completed/cancelled). Replaces polling api.downloads.getActiveDownloads()
  // -- conversions are no longer downloads at all, they're local ffmpeg
  // transcodes of the file already on disk -- and is what pause/resume/stop
  // target directly by jobId instead of operating on the download queue.
  activeJobIds: new Set(),

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
      console.log('Context Data:', contextData);
      if (Array.isArray(contextData)) {
        // Process array from taskbar selection
        downloadItems = contextData
          .map((item) => {
            if (item.id) {
              return {
                videoUrl: item.id.videoUrl,
                location: item.id.location,
                downloadName: item.id.downloadName || null,
                name: this.extractNameFromLocation(item.id.location),
                transcriptLocation: item.id.transcriptLocation || '',
                getThumbnail: item.id.getThumbnail ?? false,
                getTranscript: item.id.getTranscript ?? false,
                thumbnails: item.id.thumbnails ?? null,
                automaticCaption: item.id.automaticCaption ?? null,
              };
            }
            return null;
          })
          .filter((item) => item !== null);
      } else {
        // Process single item from menu
        if (contextData && contextData.location) {
          downloadItems = [
            {
              videoUrl: contextData.videoUrl,
              location: contextData.location,
              downloadName: contextData.downloadName || null,
              name:
                contextData.name ||
                this.extractNameFromLocation(contextData.location),
              transcriptLocation: contextData.transcriptLocation || '',
              getThumbnail: contextData.getThumbnail ?? false,
              getTranscript: contextData.getTranscript ?? false,
              thumbnails: contextData.thumbnails ?? null,
              automaticCaption: contextData.automaticCaption ?? null,
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
      // WebM used to be excluded on macOS here on the assumption the
      // platform couldn't produce it. That assumption predates the
      // local-ffmpeg conversion redesign (see handleConvertFile /
      // runConversion) -- conversion is now always a local transcode via
      // the bundled ffmpeg binary. Both macOS binaries Downlodr ships
      // (binaries/ffmpeg-arm64, binaries/ffmpeg-x64) have libvpx (VP8/VP9)
      // and libopus compiled in, verified directly against the committed
      // binaries, so there is no macOS-specific reason left to hide WebM.
      let availableFormats = [
        { id: 'mp3', label: 'MP3 (Audio)', value: 'mp3', default: true },
        { id: 'mp4', label: 'MP4 (Video)', value: 'mp4', default: false },
        { id: 'webm', label: 'WebM (Video)', value: 'webm', default: false },
        { id: 'mkv', label: 'MKV (Video)', value: 'mkv', default: false },
        { id: 'm4a', label: 'M4A (Audio)', value: 'm4a', default: false },
      ];

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
        // Batch conversions run concurrently (local ffmpeg jobs, not a
        // polled download queue), so the pause/resume/stop controls are
        // registered up front instead of waiting for a poll to notice
        // downloads have "started".
        if (itemsToConvert.length > 1) {
          await this.replaceTaskBarButtons(itemsToConvert);
        }
        await this.processBatch();
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
   * Update task bar button states without recreating them
   */
  async updateTaskBarButtonStates() {
    // Update button states based on current pause status
    try {
      // Update pause button state
      if (this.api.ui.updateTaskBarItem) {
        await this.api.ui.updateTaskBarItem('format-converter-pause', {
          buttonStyle: {
            border: '1px solid #D1D5DB',
            cursor: !this.isPaused ? 'pointer' : 'not-allowed',
            opacity: !this.isPaused ? 1 : 0.5,
            pointerEvents: !this.isPaused ? 'auto' : 'none',
          },
        });

        // Update resume button state
        await this.api.ui.updateTaskBarItem('format-converter-resume', {
          buttonStyle: {
            border: '1px solid #D1D5DB',
            cursor: this.isPaused ? 'pointer' : 'not-allowed',
            opacity: this.isPaused ? 1 : 0.5,
            pointerEvents: this.isPaused ? 'auto' : 'none',
          },
        });
      } else {
        // Fallback to full replacement if update method doesn't exist
        await this.replaceTaskBarButtons();
      }
    } catch (error) {
      console.warn('Failed to update button states, falling back to full replacement:', error);
      await this.replaceTaskBarButtons();
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
      const totalItems = this.downloadItems.length;

      return `Converting ${totalItems} ${totalItems === 1 ? 'file' : 'files'}`;
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
   * Resume paused conversions. SIGCONT-based: the same ffmpeg processes
   * that were suspended continue writing the same output file from where
   * they stopped, so unlike the old yt-dlp-redownload flow there is no
   * partial/corrupted file to clean up on resume.
   */
  async handleResume(contextData) {
    this.isPaused = false;
    this.isProcessing = true;
    await this.updateTaskBarButtonStates();

    const jobIds = [...this.activeJobIds];
    const results = await Promise.all(
      jobIds.map((id) => this.api.utilities.resumeConvertFile(id))
    );
    const failed = results.filter((r) => !r.success);

    if (failed.length === 0) {
      this.api.ui.showNotification({
        title: 'Conversions Resumed',
        message: `${jobIds.length} conversion(s) resumed successfully`,
        type: 'success',
        duration: 3000,
      });
    } else {
      this.api.ui.showNotification({
        title: 'Failed to Resume Conversions',
        message:
          failed[0]?.error || 'An error occurred while resuming conversions',
        type: 'error',
        duration: 5000,
      });
    }
  },

  /**
   * Pause all in-flight conversions (SIGSTOP the underlying ffmpeg
   * processes). Queued-but-not-yet-started items in this batch simply
   * aren't started until resumed -- processBatch checks isPaused/
   * isProcessing before kicking off each item.
   */
  async handlePause(contextData) {
    this.isPaused = true;
    this.isProcessing = false;
    await this.updateTaskBarButtonStates();

    const jobIds = [...this.activeJobIds];
    const results = await Promise.all(
      jobIds.map((id) => this.api.utilities.pauseConvertFile(id))
    );
    const failed = results.filter((r) => !r.success);

    if (failed.length === 0) {
      this.api.ui.showNotification({
        title: 'Conversion Paused',
        message: `All ongoing conversion processes have been paused`,
        type: 'default',
        duration: 3000,
      });
    } else {
      this.api.ui.showNotification({
        title: 'Failed to pause conversions',
        message:
          failed[0]?.error || `An error occurred while pausing conversions`,
        type: 'destructive',
        duration: 3000,
      });
    }
  },

  /**
   * Stop all ongoing and queued conversions. Kills every in-flight ffmpeg
   * process and clears the pending queue -- nothing to resume afterward.
   */
  async handleStop(contextData) {
    const jobIds = [...this.activeJobIds];
    await Promise.all(
      jobIds.map((id) => this.api.utilities.cancelConvertFile(id))
    );
    this.activeJobIds.clear();
    this.isProcessing = false;
    this.isPaused = false;

    await this.cleanupState();
    this.api.ui.showNotification({
      title: 'Conversion Stopped',
      message: `All ongoing conversion processes have been stopped`,
      type: 'default',
      duration: 3000,
    });

    await this.resetTaskBarButtons();
  },

  /**
   * Process conversions in batches of 5, awaiting each batch's ffmpeg jobs
   * directly instead of polling api.downloads.getActiveDownloads() -- these
   * are local transcodes, not downloads, so there is nothing in the
   * download store to poll. If paused, a batch's Promise.allSettled simply
   * sits blocked on the SIGSTOP'd ffmpeg processes and this function's own
   * continuation resumes naturally once they're SIGCONT'd, with no
   * separate restart needed from handleResume.
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

    await Promise.allSettled(
      currentBatch.map((item) => this.handleConvertFile(item, format))
    );

    if (this.isPaused) {
      this.api.ui.showNotification({
        title: 'Downloads Paused',
        message: 'Current batch paused. Resume to continue.',
        type: 'default',
        duration: 3000,
      });
      return;
    }

    if (!this.isProcessing) {
      // Stopped mid-batch -- handleStop already cleaned up state/buttons.
      return;
    }

    if (remainingQueue.length > 0) {
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
    } else {
      this.api.ui.showNotification({
        title: 'Conversion Complete',
        message: 'All items have been converted',
        type: 'default',
        duration: 3000,
      });
      await this.cleanupState();
      await this.resetTaskBarButtons();
    }
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
   * Starts a local ffmpeg transcode via api.utilities.startConvertFile and
   * awaits its completion event, tracking the jobId in activeJobIds for the
   * duration so pause/resume/stop can target it.
   */
  async runConversion(inputPath, outputPath, format) {
    const { jobId } = await this.api.utilities.startConvertFile({
      inputPath,
      outputPath,
      format,
    });
    this.activeJobIds.add(jobId);

    try {
      return await new Promise((resolve, reject) => {
        const unsubscribe = this.api.utilities.onConvertFileComplete(
          (data) => {
            if (data.jobId !== jobId) return;
            unsubscribe();
            if (data.success) {
              resolve(data);
            } else {
              reject(new Error(data.error || 'Conversion failed'));
            }
          }
        );
      });
    } finally {
      this.activeJobIds.delete(jobId);
    }
  },

  /**
   * Convert an already-downloaded local file to the requested format via
   * ffmpeg. Replaces the old flow of re-downloading the source video
   * through yt-dlp -- which needed a full yt-dlp metadata re-fetch before
   * every single conversion, causing a flat ~30s delay before any
   * conversion visibly started, regardless of which output format was
   * picked -- with a direct local transcode of the file the user already
   * has.
   */
  async handleConvertFile(contextData, requestedExt) {
    try {
      if (!contextData || !contextData.location) {
        console.log('Invalid context data:', contextData);
        this.api.ui.showNotification({
          title: 'Failed to convert format',
          message: `Error: plugin failed to receive data`,
          type: 'destructive',
          duration: 3000,
        });
        return;
      }
      // Default to mp3
      requestedExt = requestedExt || 'mp3';

      this.api.ui.showNotification({
        title: 'Converting Format',
        message: `Converting format to ${requestedExt}`,
        type: 'default',
        duration: 3000,
      });

      // Define file extensions you want to match
      const videoExtensions = ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4a', '.mp3'];

      // Get the last portion of the path
      const pathParts = contextData.location.split(/[/\\]/);
      const lastPart = pathParts[pathParts.length - 1] || '';

      // Check if the last part is a file (ends with .ext)
      const isFile = videoExtensions.some(ext => lastPart.toLowerCase().endsWith(ext));

      let inputPath;
      let directoryPath;
      if (isFile) {
        inputPath = contextData.location;
        directoryPath = contextData.location.replace(/[\/\\][^\/\\]*$/, ''); // Remove last path segment
      } else if (contextData.downloadName) {
        directoryPath = contextData.location;
        inputPath = `${directoryPath}/${contextData.downloadName}`;
      } else {
        throw new Error(
          'Could not resolve the source file path for conversion.'
        );
      }

      const finalDirectoryPath = `${directoryPath}/FormatConverter/`;

      // Create output filename
      const baseName = (contextData.name || 'video')
        .replace(/\.[^/.]+$/, '')
        .slice(0, 25);
      const fileName = baseName.startsWith('🎞️')
        ? `${baseName}_${requestedExt}.${requestedExt}`
        : `🎞️ ${baseName}_(${requestedExt}).${requestedExt}`;
      const outputPath = `${finalDirectoryPath}${fileName}`;

      // The host handler creates finalDirectoryPath itself before spawning
      // ffmpeg, so there's no separate folder-existence check here.
      await this.runConversion(inputPath, outputPath, requestedExt);

      this.api.ui.showNotification({
        title: 'Conversion Complete',
        message: `Converted to ${requestedExt}: ${baseName}`,
        type: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error('Conversion error:', error);
      // A cancel (Stop) already shows its own bulk notification -- avoid
      // piling a redundant per-item error toast on top of it.
      if (error.message !== 'CANCELLED') {
        this.api.ui.showNotification({
          title: 'Failed to convert format',
          message: `Error: ${error.message || error}`,
          type: 'destructive',
          duration: 3000,
        });
      }
      throw error;
    }
  },
};

module.exports = formatConverter;
