using Microsoft.EntityFrameworkCore;
using IdeaManagement.Data;
using IdeaManagement.Models;

namespace IdeaManagement.Services;

/// <summary>
/// Service implementation for managing ideas with business logic
/// </summary>
public class IdeaService : IIdeaService
{
    private readonly IdeaDbContext _context;
    private readonly ILogger<IdeaService> _logger;
    
    // Valid state transitions (current → allowed next states)
    private static readonly Dictionary<WorkflowState, HashSet<WorkflowState>> ValidTransitions = new()
    {
        [WorkflowState.Submitted] = new() { WorkflowState.InReview },
        [WorkflowState.InReview] = new() { WorkflowState.Approved, WorkflowState.NotApproved },
        [WorkflowState.Approved] = new() { WorkflowState.InDevelopment },
        [WorkflowState.NotApproved] = new(), // Terminal state
        [WorkflowState.InDevelopment] = new() { WorkflowState.InProduction },
        [WorkflowState.InProduction] = new() // Terminal state
    };
    
    public IdeaService(IdeaDbContext context, ILogger<IdeaService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }
    
    public async Task<IEnumerable<Idea>> GetAllIdeasAsync(
        WorkflowState? status = null, 
        string? submittedBy = null, 
        decimal? minPriorityScore = null)
    {
        _logger.LogInformation("Retrieving ideas with filters: Status={Status}, SubmittedBy={SubmittedBy}, MinPriorityScore={MinPriorityScore}",
            status, submittedBy, minPriorityScore);
        
        var query = _context.Ideas.AsQueryable();
        
        if (status.HasValue)
        {
            query = query.Where(i => i.Status == status.Value);
        }
        
        if (!string.IsNullOrWhiteSpace(submittedBy))
        {
            query = query.Where(i => i.SubmittedBy == submittedBy);
        }
        
        var ideas = await query.ToListAsync();
        
        // Filter by priority score in memory (requires BusinessCase calculation)
        if (minPriorityScore.HasValue)
        {
            ideas = ideas
                .Where(i => i.BusinessCase != null && i.BusinessCase.PriorityScore >= minPriorityScore.Value)
                .ToList();
        }
        
        return ideas;
    }
    
    public async Task<Idea?> GetIdeaByIdAsync(int id)
    {
        _logger.LogInformation("Retrieving idea with ID={Id}", id);
        return await _context.Ideas.FindAsync(id);
    }
    
    public async Task<Idea> CreateIdeaAsync(Idea idea)
    {
        if (idea == null)
            throw new ArgumentNullException(nameof(idea));
        
        _logger.LogInformation("Creating new idea: {Title}", idea.Title);
        
        // Ensure initial state and timestamps
        idea.Status = WorkflowState.Submitted;
        idea.SubmittedDate = DateTime.UtcNow;
        idea.LastModifiedDate = DateTime.UtcNow;
        
        _context.Ideas.Add(idea);
        await _context.SaveChangesAsync();
        
        _logger.LogInformation("Created idea with ID={Id}", idea.Id);
        return idea;
    }
    
    public async Task<Idea> UpdateIdeaAsync(Idea idea)
    {
        if (idea == null)
            throw new ArgumentNullException(nameof(idea));
        
        var existing = await _context.Ideas.FindAsync(idea.Id);
        if (existing == null)
        {
            _logger.LogWarning("Attempted to update non-existent idea with ID={Id}", idea.Id);
            throw new KeyNotFoundException($"Idea with ID {idea.Id} not found");
        }
        
        _logger.LogInformation("Updating idea with ID={Id}", idea.Id);
        
        // Update fields (excluding Status - use TransitionStateAsync for that)
        existing.Title = idea.Title;
        existing.Description = idea.Description;
        existing.BusinessCase = idea.BusinessCase;
        existing.ImpactMetrics = idea.ImpactMetrics;
        existing.ReviewerNotes = idea.ReviewerNotes;
        existing.LastModifiedDate = DateTime.UtcNow;
        
        await _context.SaveChangesAsync();
        return existing;
    }
    
    public async Task<bool> DeleteIdeaAsync(int id)
    {
        _logger.LogInformation("Deleting idea with ID={Id}", id);
        
        var idea = await _context.Ideas.FindAsync(id);
        if (idea == null)
        {
            _logger.LogWarning("Attempted to delete non-existent idea with ID={Id}", id);
            return false;
        }
        
        _context.Ideas.Remove(idea);
        await _context.SaveChangesAsync();
        
        _logger.LogInformation("Deleted idea with ID={Id}", id);
        return true;
    }
    
    public async Task<Idea> TransitionStateAsync(int id, WorkflowState newState, string? reviewerNotes = null)
    {
        _logger.LogInformation("Attempting to transition idea ID={Id} to state={NewState}", id, newState);
        
        var idea = await _context.Ideas.FindAsync(id);
        if (idea == null)
        {
            _logger.LogWarning("Attempted to transition non-existent idea with ID={Id}", id);
            throw new KeyNotFoundException($"Idea with ID {id} not found");
        }
        
        // Validate transition
        if (!IsValidTransition(idea.Status, newState))
        {
            _logger.LogWarning("Invalid state transition for idea ID={Id}: {CurrentState} -> {NewState}",
                id, idea.Status, newState);
            throw new InvalidOperationException(
                $"Cannot transition from {idea.Status} to {newState}. " +
                $"Allowed transitions: {string.Join(", ", ValidTransitions[idea.Status])}");
        }
        
        idea.Status = newState;
        idea.LastModifiedDate = DateTime.UtcNow;
        
        if (!string.IsNullOrWhiteSpace(reviewerNotes))
        {
            idea.ReviewerNotes = reviewerNotes;
        }
        
        await _context.SaveChangesAsync();
        
        _logger.LogInformation("Transitioned idea ID={Id} to state={NewState}", id, newState);
        return idea;
    }
    
    public async Task<IEnumerable<(Idea idea, decimal similarityScore)>> FindSimilarIdeasAsync(
        int id, 
        decimal threshold = 0.3m)
    {
        _logger.LogInformation("Finding similar ideas to ID={Id} with threshold={Threshold}", id, threshold);
        
        var targetIdea = await _context.Ideas.FindAsync(id);
        if (targetIdea == null)
        {
            _logger.LogWarning("Attempted to find similar ideas for non-existent idea with ID={Id}", id);
            throw new KeyNotFoundException($"Idea with ID {id} not found");
        }
        
        // Get all other ideas and calculate similarity in memory
        // For large datasets, this should use vector search or full-text search
        var allIdeas = await _context.Ideas
            .Where(i => i.Id != id)
            .ToListAsync();
        
        var similarIdeas = allIdeas
            .Select(i => (idea: i, score: targetIdea.CalculateSimilarity(i)))
            .Where(x => x.score >= threshold)
            .OrderByDescending(x => x.score)
            .ToList();
        
        _logger.LogInformation("Found {Count} similar ideas to ID={Id}", similarIdeas.Count, id);
        return similarIdeas;
    }
    
    private static bool IsValidTransition(WorkflowState current, WorkflowState next)
    {
        return ValidTransitions.TryGetValue(current, out var allowedStates) && allowedStates.Contains(next);
    }
}
