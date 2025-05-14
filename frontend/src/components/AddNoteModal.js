import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './AddNoteModal.css';

// Services
import dbService from '../services/db';
import apiService from '../services/api';

const AddNoteModal = ({ isOpen, onClose, onNoteAdded }) => {
  const [activeTab, setActiveTab] = useState('manual');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Reset form state
  const resetForm = useCallback(() => {
    setTitle('');
    setContent('');
    setTags('');
    setError(null);
    setUploadProgress(0);
    setIsLoading(false);
  }, []);

  // Quill editor modules/formats
  const modules = {
    toolbar: [
      [{ 'font': [] }, { 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'script': 'sub' }, { 'script': 'super' }],
      [{ 'header': 1 }, { 'header': 2 }, 'blockquote', 'code-block'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
      ['link', 'image', 'video'],
      ['clean']
    ],
  };

  const formats = [
    'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'script',
    'header', 'blockquote', 'code-block',
    'indent', 'list',
    'link', 'image', 'video'
  ];

  // Dropzone setup
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    onDrop: handleFileDrop,
    noClick: !!error, // Disable click when there's an error
  });

  // Handle file upload
  async function handleFileDrop(acceptedFiles) {
    if (acceptedFiles.length === 0) {
      setError('No valid files were selected. Please try again with a .pdf, .txt, or .docx file.');
      return;
    }

    const file = acceptedFiles[0];
    setIsLoading(true);
    setUploadProgress(0);
    setError(null);

    try {
      console.log("File upload started:", file.name);
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 300);

      // Additional validation for file type
      const fileType = file.type;
      const fileExtension = file.name.split('.').pop().toLowerCase();
      
      if (!(
        fileType === 'application/pdf' || 
        fileType === 'text/plain' || 
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileExtension === 'pdf' || 
        fileExtension === 'txt' || 
        fileExtension === 'docx'
      )) {
        clearInterval(progressInterval);
        throw new Error(`File type ${fileType || fileExtension} is not supported. Please use PDF, TXT, or DOCX files.`);
      }

      // Upload to server using db service
      console.log("Uploading file to server...");
      const response = await dbService.uploadFile(file);
      console.log("File upload response:", response);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // No need to save to local database again as the API already returns the saved note
      
      // Reset upload progress after a delay
      setTimeout(() => {
        setUploadProgress(0);
        onNoteAdded();
        onClose();
      }, 1000);
      
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(typeof err === 'string' ? err : 
               err.message || 'Failed to upload file. Please try again with a different file.');
      setUploadProgress(0);
    } finally {
      setIsLoading(false);
    }
  }

  // Handle manual note creation
  const handleCreateNote = async (e) => {
    e.preventDefault();
    
    if (!title || !content) {
      setError('Title and content are required.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const newNote = {
        id: Date.now().toString(),
        title,
        content,
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Save to local database
      await dbService.saveNoteLocally(newNote);
      
      // Also save to server if possible
      try {
        await apiService.uploadNote(newNote);
      } catch (apiError) {
        console.error('Error saving note to server:', apiError);
        // Continue even if server save fails
      }
      
      // Clear form
      resetForm();
      
      // Close modal and refresh notes
      onNoteAdded();
      onClose();
      
    } catch (err) {
      console.error('Error creating note:', err);
      setError('Failed to create note. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Close and reset modal
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Change tabs
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError(null);
  };

  // Don't render if modal is closed
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={handleClose}>×</button>
        
        <h2>Add New Note</h2>
        
        <div className="modal-tabs">
          <button 
            className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
            onClick={() => handleTabChange('manual')}
          >
            Create Manually
          </button>
          <button 
            className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => handleTabChange('upload')}
          >
            Upload File
          </button>
        </div>
        
        {error && (
          <div className="modal-error">
            <p>{error}</p>
            <button 
              className="btn error-dismiss-btn" 
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}
        
        {activeTab === 'manual' ? (
          <form className="note-form" onSubmit={handleCreateNote}>
            <div className="form-group">
              <label htmlFor="note-title" className="form-label">Title</label>
              <input
                type="text"
                id="note-title"
                className="form-control"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter note title"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="note-content" className="form-label">Content</label>
              <div className="text-editor-container">
                <ReactQuill
                  theme="snow"
                  modules={modules}
                  formats={formats}
                  value={content}
                  onChange={setContent}
                  placeholder="Enter your note content here..."
                />
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="note-tags" className="form-label">Tags (comma separated)</label>
              <input
                type="text"
                id="note-tags"
                className="form-control"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. biology, chapter 1, cells"
              />
            </div>
            
            <div className="form-actions">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn" 
                disabled={isLoading}
              >
                {isLoading ? 'Creating...' : 'Create Note'}
              </button>
            </div>
          </form>
        ) : (
          <div className="upload-tab">
            {error ? (
              <div className="retry-container">
                <p>Please check that your file is in the correct format and try again.</p>
                <div className="retry-actions">
                  <button 
                    className="btn retry-btn" 
                    onClick={() => {
                      setError(null);
                      setUploadProgress(0);
                      open();
                    }}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              <div className="upload-area-modal" {...getRootProps()}>
                <input {...getInputProps()} />
                {isDragActive ? (
                  <div className="upload-active">
                    <div className="upload-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64">
                        <path fill="currentColor" d="M11 14.9V7.1L9.4 8.7l-1.4-1.4L12 3.4l4 3.9-1.4 1.4L13 7.1v7.8l1.6-1.6 1.4 1.4-4 4-4-4 1.4-1.4z"/>
                      </svg>
                    </div>
                    <p>Drop the file here...</p>
                  </div>
                ) : (
                  <div>
                    <div className="upload-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64">
                        <path fill="currentColor" d="M12 16.9l-6.9-6.9 1.4-1.4L11 13V3h2v10l4.5-4.4 1.4 1.4L12 16.9zm9 4.1v-7h-2v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2z"/>
                      </svg>
                    </div>
                    <p>Drag & drop a PDF or text file here, or click to select a file</p>
                    <button className="btn upload-btn">Select File</button>
                  </div>
                )}
              </div>
            )}
            
            {uploadProgress > 0 && (
              <div className="progress-container">
                <div className="progress-bar-modal">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="progress-text">{Math.round(uploadProgress)}%</span>
              </div>
            )}
            
            <div className="upload-info">
              <h3>Supported File Types</h3>
              <ul>
                <li>PDF documents (.pdf)</li>
                <li>Text files (.txt)</li>
                <li>Word documents (.docx)</li>
              </ul>
              <p className="file-tip">Note: Files must be properly formatted and not password protected.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddNoteModal; 