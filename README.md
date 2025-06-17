# Format Converter Plugin

## Overview

The Format Converter Plugin provides seamless format conversion for your downloaded videos and audio files. This powerful tool allows you to convert media files to different formats without needing external software, making it perfect for creating compatible files for various devices and platforms.

Whether you need to extract audio from videos, convert between video formats, or optimize files for specific use cases, this plugin streamlines the entire process. With intelligent format detection and one-click conversion, you can easily transform your downloads into the exact format you need while preserving quality and maintaining organized file management.

## Features

- **Multiple format support** - Convert to popular audio and video formats
- **Audio extraction**:
  - MP3 (universal audio compatibility)
  - M4A (high-quality audio for Apple devices)
- **Video conversion**:
  - MP4 (universal video compatibility)
  - WebM (web-optimized format)
  - MKV (high-quality container format)
- **Smart format selection** - Automatically detects best available source formats
- **Batch conversion** - Convert multiple files simultaneously from taskbar selection
- **Organized output** - Saves converted files to dedicated "FormatConverter" subfolder
- **Platform optimization** - Intelligent handling for YouTube, Vimeo, BiliBili, and other platforms
- **Quality preservation** - Maintains optimal quality during conversion process
- **Progress notifications** - Real-time feedback during conversion
- **Context integration** - Access conversion directly from download context menu and taskbar

## Installation

1. Ensure you have Downlodr version 1.3.4 or higher installed
2. Download the Format Converter Plugin package
3. Extract the folder to your preferred location
4. Click the "Plugin" button in the top left corner of the Task Bar window
5. Click the "Add Plugin" button to locate the folder you extracted the plugin to and press "Select Folder"
6. The plugin will be loaded automatically on startup

**Note: Make sure that the folder includes the `index.js` file and `manifest.json` file**

## Usage

### Single File Conversion
1. Download a video or audio file using Downlodr
2. Once download is complete, right-click on the file and select "Convert Format" from the context menu
3. Choose your desired output format from the format selector:
   - **MP3 (Audio)** - Universal audio format
   - **MP4 (Video)** - Universal video format  
   - **WebM (Video)** - Web-optimized format
   - **MKV (Video)** - High-quality container
   - **M4A (Audio)** - High-quality audio format
4. Click "Convert" to start the process
5. Monitor progress through notification messages

### Batch Conversion
1. Select multiple downloaded files in the taskbar
2. Click the "Convert Format" button in the taskbar
3. Choose the desired output format for all selected files
4. The plugin will process each file sequentially
5. Converted files will be saved to individual "FormatConverter" subfolders

## Supported Formats

### Input Formats
- **Video**: MP4, WebM, MKV, AVI, MOV, FLV, and most formats supported by yt-dlp
- **Audio**: MP3, M4A, OGG, WAV, FLAC, AAC, and most audio formats

### Output Formats
- **Audio**:
  - **MP3** - Universal compatibility, smaller file sizes
  - **M4A** - High quality, Apple ecosystem optimized
- **Video**:
  - **MP4** - Universal compatibility, widely supported
  - **WebM** - Web-optimized, excellent compression
  - **MKV** - High quality, supports multiple tracks

## Technical Details

The plugin performs the following operations:

- **Format Analysis**: Intelligently analyzes source video formats and quality options
- **Platform Detection**: Optimizes conversion strategy based on source platform (YouTube, Vimeo, etc.)
- **Quality Selection**: 
  - Automatically selects best available audio streams for audio conversion
  - Chooses optimal video+audio combinations for video formats
  - Preserves maximum quality while ensuring compatibility
- **File Management**: 
  - Creates organized "FormatConverter" subfolder structure
  - Generates descriptive filenames with format indicators
  - Handles filename conflicts and special characters
- **Conversion Process**: Utilizes yt-dlp's powerful conversion capabilities for reliable format transformation
- **Error Handling**: Comprehensive error detection and user-friendly error messages

## Requirements

- Downlodr v1.3.4+
- yt-dlp (included with Downlodr)
- FFmpeg (included with Downlodr for format conversion)
- Write permissions to the download directory
- Sufficient disk space for converted files

## Troubleshooting

### Conversion Failed
If conversion fails:
- Ensure the source file downloaded completely without errors
- Verify sufficient disk space for the output file
- Check that the source format is compatible with the target format
- Try converting to a different format to isolate the issue

### No Format Options Available
If no formats appear in the selector:
- Ensure the original download completed successfully
- Verify the source URL is still accessible
- Try re-downloading the original file with different quality settings

### Slow Conversion Speed
For improved performance:
- Close unnecessary applications to free up system resources
- Ensure adequate free disk space
- Consider converting fewer files simultaneously for faster processing

### Permission Errors
If you encounter permission issues:
- Verify write permissions to the download directory
- Run Downlodr as administrator if necessary
- Check that antivirus software isn't blocking file operations

## Output Organization

Converted files are automatically organized as follows: 

<pre>
Original Download Folder/
├── original_video.mp4
└── FormatConverter/
└── 🎞️ original_video.mp3
</pre>

The 🎞️ emoji prefix helps identify converted files at a glance.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

Developed by Downlodr

## Version History

- 1.0.0 - Initial release
  - Multi-format conversion support (MP3, MP4, WebM, MKV, M4A)
  - Batch conversion capabilities
  - Platform-specific optimization
  - Context menu and taskbar integration
  - Intelligent format detection and quality selection
  - Organized output file management

## Privacy Note

This plugin processes files locally on your device. No data is transmitted to external servers during the conversion process. All conversion operations are performed using local yt-dlp and FFmpeg installations.

## Contributing

Interested in contributing to this plugin? Please submit issues and feature requests through the appropriate channels or contact the development team.

## Support

For support with this plugin:
- Check the troubleshooting section above
- Ensure you're using the latest version of Downlodr
- Verify all requirements are met
- Contact the development team for additional assistance