import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Download,
  Eye,
  User,
  FileText,
  TrendingUp,
  Award,
  Plus,
  X,
  Save,
  Edit,
  Trash2
} from 'lucide-react';
import { cn } from '../../constants';
import { useUI } from '../ui/UIProvider';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const researchCategories = [
  'All Categories',
  'Artificial Intelligence',
  'Web Development',
  'Mobile Development',
  'Data Science',
  'Cybersecurity',
  'Cloud Computing',
  'Software Engineering'
];

const getStatusColor = (status) => {
  switch (status) {
    case 'Published':
      return 'bg-emerald-50 text-emerald-600';
    case 'Under Review':
      return 'bg-yellow-50 text-yellow-600';
    case 'Draft':
      return 'bg-gray-50 text-gray-600';
    case 'Rejected':
      return 'bg-red-50 text-red-600';
    case 'Ongoing':
      return 'bg-blue-50 text-blue-600';
    default:
      return 'bg-gray-50 text-gray-600';
  }
};

const emptyResearchForm = {
  title: '',
  description: '',
  authors: '',
  category: 'Artificial Intelligence',
  status: 'Ongoing',
  keywords: '',
  citations: 0,
  views: 0,
  downloads: 0,
  journal: '',
  doi: '',
  date: '',
  year: new Date().getFullYear().toString()
};

export const CollegeResearch = () => {
  const { showError, showSuccess, confirm } = useUI();
  const [research, setResearch] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedResearch, setSelectedResearch] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState(emptyResearchForm);

  useEffect(() => {
    fetchResearch();
  }, [selectedCategory]);

  const fetchResearch = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory !== 'All Categories') params.append('category', selectedCategory);
      
      const response = await fetch(`${API_URL}/api/research?${params}`);
      const data = await response.json();
      if (data.success) {
        setResearch(data.data);
      }
    } catch (error) {
      console.error('Error fetching research:', error);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (item) => {
    setSelectedResearch(item);
    setFormData({
      title: item.title || '',
      description: item.description || '',
      authors: (item.authors || []).join(', '),
      category: item.category || 'Artificial Intelligence',
      status: item.status || 'Ongoing',
      keywords: (item.keywords || []).join(', '),
      citations: item.citations || 0,
      views: item.views || 0,
      downloads: item.downloads || 0,
      journal: item.journal || '',
      doi: item.doi || '',
      date: item.date || '',
      year: item.year || new Date().getFullYear().toString()
    });
    setShowEditModal(true);
  };

  const handleAddResearch = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formData,
        authors: formData.authors.split(',').map(a => a.trim()).filter(a => a),
        keywords: formData.keywords.split(',').map(k => k.trim()).filter(k => k)
      };
      
      const response = await fetch(`${API_URL}/api/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      });
      const data = await response.json();
      if (data.success) {
        setShowAddModal(false);
        setFormData(emptyResearchForm);
        fetchResearch();
        showSuccess('Research added', 'The research entry was saved successfully.');
      } else {
        showError('Unable to add research', data.message);
      }
    } catch (error) {
      showError('Unable to add research', error.message);
    }
  };

  const handleEditResearch = async (e) => {
    e.preventDefault();
    if (!selectedResearch?.id) return;

    try {
      const dataToSend = {
        ...formData,
        authors: formData.authors.split(',').map((author) => author.trim()).filter(Boolean),
        keywords: formData.keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean)
      };

      const response = await fetch(`${API_URL}/api/research/${selectedResearch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      });
      const data = await response.json();
      if (data.success) {
        setShowEditModal(false);
        setSelectedResearch(data.data);
        fetchResearch();
        showSuccess('Research updated', 'The research entry was updated successfully.');
      } else {
        showError('Unable to update research', data.message);
      }
    } catch (error) {
      showError('Unable to update research', error.message);
    }
  };

  const formatResearchDate = (dateValue) => {
    if (!dateValue) {
      return 'Not specified';
    }

    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) {
      return 'Not specified';
    }

    return parsedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const handleDeleteResearch = async () => {
    const approved = await confirm({
      title: 'Delete research entry?',
      description: `This will remove "${selectedResearch?.title || 'the selected research'}".`,
      confirmText: 'Delete research',
      tone: 'danger',
    });
    if (!approved) return;
    
    try {
      const response = await fetch(`${API_URL}/api/research/${selectedResearch.id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        setSelectedResearch(null);
        fetchResearch();
        showSuccess('Research deleted', 'The research entry was removed.');
      } else {
        showError('Unable to delete research', data.message);
      }
    } catch (error) {
      showError('Unable to delete research', error.message);
    }
  };

  const filteredResearch = research.filter(r => {
    const matchesSearch = r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (r.authors || []).some(author => author.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (r.keywords || []).some(keyword => keyword.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'All Categories' || r.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">College Research</h2>
          <p className="text-sm text-gray-500">Browse and manage research publications</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-colors",
                viewMode === 'grid' 
                  ? "bg-white text-orange-600 shadow-sm" 
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-colors",
                viewMode === 'list' 
                  ? "bg-white text-orange-600 shadow-sm" 
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              List
            </button>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
          >
            <Plus size={18} />
            Add Research
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by title, author, or keywords..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
            />
          </div>
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-gray-50 border-none text-sm font-medium rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            {researchCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-bold">Showing {filteredResearch.length} research papers</span>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full p-8 text-center text-gray-400">Loading research...</div>
          ) : filteredResearch.length === 0 ? (
            <div className="col-span-full p-8 text-center text-gray-400">No research found</div>
          ) : (
            filteredResearch.map((research) => {
            const StatusIcon = research.status === 'Published' ? Award : FileText;
            return (
              <div 
                key={research.id}
                className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedResearch(research)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 w-fit mb-2", getStatusColor(research.status))}>
                      <StatusIcon size={10} />
                      {research.status}
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">{research.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                      <User size={12} />
                      <span className="line-clamp-1">{(research.authors || []).join(', ') || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Category</p>
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                      {research.category}
                    </span>
                  </div>
                  
                  <p className="text-xs text-gray-600 line-clamp-3">{research.description || 'No description provided.'}</p>
                  
                  <div className="flex flex-wrap gap-1">
                    {research.keywords.slice(0, 3).map((keyword, i) => (
                      <span key={i} className="text-[10px] text-gray-500 bg-gray-50 px-2 py-1 rounded">
                        {keyword}
                      </span>
                    ))}
                    {research.keywords.length > 3 && (
                      <span className="text-[10px] text-gray-400">+{research.keywords.length - 3} more</span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <TrendingUp size={12} />
                        <span>{research.citations}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye size={12} />
                        <span>{research.views}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {research.year}
                    </div>
                  </div>
                </div>
              </div>
            );
          }))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading research...</div>
          ) : filteredResearch.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No research found</div>
          ) : (
            filteredResearch.map((research) => {
            const StatusIcon = research.status === 'Published' ? Award : FileText;
            return (
              <div 
                key={research.id}
                className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedResearch(research)}
              >
                <div className="flex items-start gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1", getStatusColor(research.status))}>
                        <StatusIcon size={10} />
                        {research.status}
                      </span>
                      <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                        {research.category}
                      </span>
                      <span className="text-xs text-gray-400">{research.year}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{research.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                      <User size={14} />
                      <span>{(research.authors || []).join(', ') || 'N/A'}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{research.description || 'No description provided.'}</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(research.keywords || []).map((keyword, i) => (
                        <span key={i} className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                          {keyword}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-6 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <TrendingUp size={12} />
                        <span>{research.citations} citations</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye size={12} />
                        <span>{research.views} views</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Download size={12} />
                        <span>{research.downloads} downloads</span>
                      </div>
                    </div>
                  </div>
                  <button className="p-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-400" onClick={(e) => {
                    e.stopPropagation();
                    setSelectedResearch(research);
                  }}>
                    <Eye size={18} />
                  </button>
                </div>
              </div>
            );
          }))}
        </div>
      )}

      {/* Research Detail Modal */}
      {selectedResearch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedResearch(null)}>
          <div 
            className="bg-white rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className={cn("text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1", getStatusColor(selectedResearch.status))}>
                    {selectedResearch.status}
                  </span>
                  <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                    {selectedResearch.category}
                  </span>
                  <span className="text-xs text-gray-400">{selectedResearch.year}</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{selectedResearch.title}</h2>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                  <User size={16} />
                  <span>{(selectedResearch.authors || []).join(', ') || 'N/A'}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedResearch(null)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-xl">
                <h3 className="text-sm font-bold text-gray-900 mb-2">Research Summary</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{selectedResearch.description || 'No description provided.'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Journal</p>
                  <p className="text-sm font-bold text-gray-900">{selectedResearch.journal}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">DOI</p>
                  <p className="text-sm font-bold text-gray-900">{selectedResearch.doi}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Publication Date</p>
                  <p className="text-sm font-bold text-gray-900">
                    {formatResearchDate(selectedResearch.date)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Status</p>
                  <span className={cn("text-xs font-bold px-3 py-1 rounded-full", getStatusColor(selectedResearch.status))}>
                    {selectedResearch.status}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {(selectedResearch.keywords || []).map((keyword, i) => (
                    <span key={i} className="text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-full">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                <div className="text-center p-4 bg-orange-50 rounded-xl">
                  <TrendingUp className="text-orange-600 mx-auto mb-2" size={20} />
                  <p className="text-2xl font-bold text-gray-900">{selectedResearch.citations}</p>
                  <p className="text-xs text-gray-500">Citations</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <Eye className="text-blue-600 mx-auto mb-2" size={20} />
                  <p className="text-2xl font-bold text-gray-900">{selectedResearch.views}</p>
                  <p className="text-xs text-gray-500">Views</p>
                </div>
                <div className="text-center p-4 bg-emerald-50 rounded-xl">
                  <Download className="text-emerald-600 mx-auto mb-2" size={20} />
                  <p className="text-2xl font-bold text-gray-900">{selectedResearch.downloads}</p>
                  <p className="text-xs text-gray-500">Downloads</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => openEditModal(selectedResearch)}
                  className="px-4 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
                >
                  <Edit size={16} />
                  Edit
                </button>
                <button 
                  onClick={handleDeleteResearch}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                  Delete Research
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Research Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Add New Research</h2>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddResearch} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({...prev, title: e.target.value}))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  autoComplete="off"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Authors (comma-separated)</label>
                  <input
                    type="text"
                    autoComplete="off"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={formData.authors}
                    onChange={(e) => setFormData(prev => ({...prev, authors: e.target.value}))}
                    placeholder="Dr. John Smith, Prof. Maria Garcia"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({...prev, category: e.target.value}))}
                  >
                    {researchCategories.filter(c => c !== 'All Categories').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({...prev, status: e.target.value}))}
                  >
                    <option value="Ongoing">Ongoing</option>
                    <option value="Published">Published</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input
                    type="text"
                    autoComplete="off"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={formData.year}
                    onChange={(e) => setFormData(prev => ({...prev, year: e.target.value}))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Publication Date</label>
                  <input
                    type="date"
                    autoComplete="off"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({...prev, date: e.target.value}))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Journal</label>
                  <input
                    type="text"
                    autoComplete="off"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={formData.journal}
                    onChange={(e) => setFormData(prev => ({...prev, journal: e.target.value}))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DOI</label>
                  <input
                    type="text"
                    autoComplete="off"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={formData.doi}
                    onChange={(e) => setFormData(prev => ({...prev, doi: e.target.value}))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keywords (comma-separated)</label>
                <input
                  type="text"
                  autoComplete="off"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  value={formData.keywords}
                  onChange={(e) => setFormData(prev => ({...prev, keywords: e.target.value}))}
                  placeholder="Machine Learning, Education, Analytics"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Edit Research</h2>
              <button type="button" onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleEditResearch} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input type="text" required autoComplete="off" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all" value={formData.title} onChange={(e) => setFormData(prev => ({...prev, title: e.target.value}))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea autoComplete="off" rows={4} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all" value={formData.description} onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Authors (comma-separated)</label>
                  <input type="text" autoComplete="off" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all" value={formData.authors} onChange={(e) => setFormData(prev => ({...prev, authors: e.target.value}))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all" value={formData.category} onChange={(e) => setFormData(prev => ({...prev, category: e.target.value}))}>
                    {researchCategories.filter(c => c !== 'All Categories').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all" value={formData.status} onChange={(e) => setFormData(prev => ({...prev, status: e.target.value}))}>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Published">Published</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input type="text" autoComplete="off" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all" value={formData.year} onChange={(e) => setFormData(prev => ({...prev, year: e.target.value}))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Publication Date</label>
                  <input type="date" autoComplete="off" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all" value={formData.date} onChange={(e) => setFormData(prev => ({...prev, date: e.target.value}))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Journal</label>
                  <input type="text" autoComplete="off" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all" value={formData.journal} onChange={(e) => setFormData(prev => ({...prev, journal: e.target.value}))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DOI</label>
                  <input type="text" autoComplete="off" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all" value={formData.doi} onChange={(e) => setFormData(prev => ({...prev, doi: e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keywords (comma-separated)</label>
                <input type="text" autoComplete="off" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all" value={formData.keywords} onChange={(e) => setFormData(prev => ({...prev, keywords: e.target.value}))} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                  <Save size={18} />
                  Save Changes
                </button>
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 rounded-xl transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

