using IdeaManagement.Models;

namespace IdeaManagement.Services;

/// <summary>
/// Service interface for managing ideas
/// </summary>
public interface IIdeaService
{
    /// <summary>
    /// Get all ideas with optional filtering
    /// </summary>
    /// <param name="status">Filter by workflow status</param>
    /// <param name="submittedBy">Filter by submitter</param>
    /// <param name="minPriorityScore">Filter by minimum priority score</param>
    /// <returns>List of ideas matching criteria</returns>
    Task<IEnumerable<Idea>> GetAllIdeasAsync(WorkflowState? status = null, string? submittedBy = null, decimal? minPriorityScore = null);
    
    /// <summary>
    /// Get a single idea by ID
    /// </summary>
    /// <param name="id">Idea ID</param>
    /// <returns>Idea if found, null otherwise</returns>
    Task<Idea?> GetIdeaByIdAsync(int id);
    
    /// <summary>
    /// Create a new idea
    /// </summary>
    /// <param name="idea">Idea to create</param>
    /// <returns>Created idea with ID</returns>
    Task<Idea> CreateIdeaAsync(Idea idea);
    
    /// <summary>
    /// Update an existing idea
    /// </summary>
    /// <param name="idea">Idea with updated fields</param>
    /// <returns>Updated idea</returns>
    /// <exception cref="KeyNotFoundException">If idea doesn't exist</exception>
    Task<Idea> UpdateIdeaAsync(Idea idea);
    
    /// <summary>
    /// Delete an idea
    /// </summary>
    /// <param name="id">Idea ID to delete</param>
    /// <returns>True if deleted, false if not found</returns>
    Task<bool> DeleteIdeaAsync(int id);
    
    /// <summary>
    /// Transition idea to a new workflow state with validation
    /// </summary>
    /// <param name="id">Idea ID</param>
    /// <param name="newState">New workflow state</param>
    /// <param name="reviewerNotes">Optional reviewer notes</param>
    /// <returns>Updated idea</returns>
    /// <exception cref="InvalidOperationException">If transition is invalid</exception>
    Task<Idea> TransitionStateAsync(int id, WorkflowState newState, string? reviewerNotes = null);
    
    /// <summary>
    /// Find similar ideas based on title/description matching
    /// </summary>
    /// <param name="id">Idea ID to compare against</param>
    /// <param name="threshold">Minimum similarity score (0-1)</param>
    /// <returns>List of similar ideas with similarity scores</returns>
    Task<IEnumerable<(Idea idea, decimal similarityScore)>> FindSimilarIdeasAsync(int id, decimal threshold = 0.3m);
}
