// // 'use client';

// import { useState } from 'react';

// export interface Project {
//   id: string;
//   name: string;
//   description?: string;
//   createdAt: Date;
// }

// interface ProjectsViewProps {
//   projects: Project[];
//   currentProjectId?: string;
//   onProjectSelect: (projectId: string) => void;
//   onProjectCreate: (name: string, description?: string) => void;
//   onProjectDelete: (projectId: string) => void;
// }

// export default function ProjectsView({
//   projects,
//   currentProjectId,
//   onProjectSelect,
//   onProjectCreate,
//   onProjectDelete
// }: ProjectsViewProps) {
//   const [isCreating, setIsCreating] = useState(false);
//   const [newProjectName, setNewProjectName] = useState('');
//   const [newProjectDesc, setNewProjectDesc] = useState('');

//   const handleCreate = () => {
//     if (newProjectName.trim()) {
//       onProjectCreate(newProjectName, newProjectDesc);
//       setNewProjectName('');
//       setNewProjectDesc('');
//       setIsCreating(false);
//     }
//   };

//   return (
//     <div className="h-full flex flex-col p-4">
//       <div className="mb-3">
//         <p className="text-xs" style={{ color: 'var(--sidebar-text-muted)' }}>
//           Organize your writing into projects
//         </p>
//       </div>

//       <div className="mb-4">
//         <button
//           onClick={() => setIsCreating(!isCreating)}
//           className="w-full px-4 py-2.5 font-medium transition-all shadow-sm"
//           style={{
//             background: 'var(--btn-primary-bg)',
//             color: 'var(--chat-user-text)',
//             borderRadius: 'var(--radius-lg)'
//           }}
//           onMouseEnter={(e) => {
//             e.currentTarget.style.background = 'var(--btn-primary-hover)';
//             e.currentTarget.style.transform = 'translateY(-1px)';
//             e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
//           }}
//           onMouseLeave={(e) => {
//             e.currentTarget.style.background = 'var(--btn-primary-bg)';
//             e.currentTarget.style.transform = 'translateY(0)';
//             e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
//           }}
//         >
//           {isCreating ? '✕ Cancel' : '+ New Project'}
//         </button>
//       </div>

//       {isCreating && (
//         <div 
//           className="mb-4 p-4 space-y-3 shadow-sm"
//           style={{ 
//             background: 'var(--sidebar-item-bg)',
//             borderRadius: 'var(--radius-lg)'
//           }}
//         >
//           <input
//             type="text"
//             placeholder="Project name (e.g., 'Fantasy Novel')"
//             value={newProjectName}
//             onChange={(e) => setNewProjectName(e.target.value)}
//             className="w-full p-3 border text-sm transition-all"
//             style={{
//               background: 'var(--editor-bg)',
//               color: 'var(--editor-text)',
//               borderColor: 'var(--border-input)',
//               borderRadius: 'var(--radius-md)'
//             }}
//             autoFocus
//           />
//           <textarea
//             placeholder="Description (optional)"
//             value={newProjectDesc}
//             onChange={(e) => setNewProjectDesc(e.target.value)}
//             className="w-full h-16 p-3 border text-sm resize-none transition-all"
//             style={{
//               background: 'var(--editor-bg)',
//               color: 'var(--editor-text)',
//               borderColor: 'var(--border-input)',
//               borderRadius: 'var(--radius-md)'
//             }}
//           />
//           <button
//             onClick={handleCreate}
//             disabled={!newProjectName.trim()}
//             className="w-full py-2.5 text-sm font-medium transition-all shadow-sm"
//             style={{
//               background: (!newProjectName.trim()) ? 'var(--btn-secondary-bg)' : '#15803d',
//               color: '#ffffff',
//               cursor: (!newProjectName.trim()) ? 'not-allowed' : 'pointer',
//               borderRadius: 'var(--radius-md)'
//             }}
//             onMouseEnter={(e) => {
//               if (newProjectName.trim()) {
//                 e.currentTarget.style.background = '#166534';
//                 e.currentTarget.style.transform = 'translateY(-1px)';
//               }
//             }}
//             onMouseLeave={(e) => {
//               if (newProjectName.trim()) {
//                 e.currentTarget.style.background = '#15803d';
//                 e.currentTarget.style.transform = 'translateY(0)';
//               }
//             }}
//           >
//             Create Project
//           </button>
//         </div>
//       )}

//       <div className="flex-1 overflow-y-auto space-y-2">
//         {projects.length === 0 ? (
//           <div 
//             className="text-center py-12 text-sm"
//             style={{ color: 'var(--sidebar-text-muted)' }}
//           >
//             <div className="text-4xl mb-3">📁</div>
//             <p className="font-medium mb-1">No projects yet</p>
//             <p className="text-xs">Create a project to organize your writing</p>
//           </div>
//         ) : (
//           projects.map((project) => (
//             <div
//               key={project.id}
//               onClick={() => onProjectSelect(project.id)}
//               className="p-4 cursor-pointer transition-all shadow-sm"
//               style={{
//                 background: currentProjectId === project.id 
//                   ? 'var(--sidebar-item-selected)' 
//                   : 'var(--sidebar-item-bg)',
//                 color: currentProjectId === project.id 
//                   ? 'var(--chat-user-text)' 
//                   : 'var(--sidebar-text)',
//                 borderRadius: 'var(--radius-lg)'
//               }}
//               onMouseEnter={(e) => {
//                 if (currentProjectId !== project.id) {
//                   e.currentTarget.style.background = 'var(--sidebar-item-hover)';
//                   e.currentTarget.style.transform = 'translateY(-1px)';
//                 }
//               }}
//               onMouseLeave={(e) => {
//                 if (currentProjectId !== project.id) {
//                   e.currentTarget.style.background = 'var(--sidebar-item-bg)';
//                   e.currentTarget.style.transform = 'translateY(0)';
//                 }
//               }}
//             >
//               <div className="flex items-start justify-between mb-1">
//                 <div className="flex-1">
//                   <h3 className="font-bold text-base mb-1">{project.name}</h3>
//                   {project.description && (
//                     <p 
//                       className="text-xs"
//                       style={{
//                         color: currentProjectId === project.id 
//                           ? 'var(--chat-user-text)' 
//                           : 'var(--sidebar-text-muted)',
//                         opacity: currentProjectId === project.id ? 0.8 : 1
//                       }}
//                     >
//                       {project.description}
//                     </p>
//                   )}
//                 </div>
//                 <button
//                   onClick={(e) => {
//                     e.stopPropagation();
//                     if (confirm(`Delete project "${project.name}"? This will remove all associated files.`)) {
//                       onProjectDelete(project.id);
//                     }
//                   }}
//                   className="text-xs ml-2 transition-colors"
//                   style={{
//                     color: currentProjectId === project.id 
//                       ? 'var(--chat-user-text)' 
//                       : 'var(--sidebar-text-muted)',
//                     opacity: currentProjectId === project.id ? 0.8 : 1
//                   }}
//                   onMouseEnter={(e) => {
//                     e.currentTarget.style.color = '#dc2626';
//                   }}
//                   onMouseLeave={(e) => {
//                     e.currentTarget.style.color = currentProjectId === project.id 
//                       ? 'var(--chat-user-text)' 
//                       : 'var(--sidebar-text-muted)';
//                   }}
//                   title="Delete project"
//                 >
//                   🗑️
//                 </button>
//               </div>
//               <div 
//                 className="text-xs mt-2"
//                 style={{
//                   color: currentProjectId === project.id 
//                     ? 'var(--chat-user-text)' 
//                     : 'var(--sidebar-text-muted)',
//                   opacity: currentProjectId === project.id ? 0.8 : 1
//                 }}
//               >
//                 Created {new Date(project.createdAt).toLocaleDateString()}
//               </div>
//             </div>
//           ))
//         )}
//       </div>

//       {/* <style jsx>{`
//         input::placeholder,
//         textarea::placeholder {
//           color: var(--editor-text-muted);
//         }
//       `}</style> */}
//     </div>
//   );
// }