using System.ComponentModel.DataAnnotations;

namespace IdeaManagement.Models;

/// <summary>
/// Represents an idea submitted to the system
/// Tracks workflow state, business case, and impact metrics
/// </summary>
public class Idea
{
    /// <summary>
    /// Unique identifier
    /// </summary>
    public int Id { get; set; }
    
    /// <summary>
    /// Short title describing the idea (max 200 chars)
    /// </summary>
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;
    
    /// <summary>
    /// Detailed description of the idea (max 2000 chars)
    /// </summary>
    [Required]
    [MaxLength(2000)]
    public string Description { get; set; } = string.Empty;
    
    /// <summary>
    /// Email or username of the person who submitted the idea
    /// </summary>
    [Required]
    [MaxLength(255)]
    public string SubmittedBy { get; set; } = string.Empty;
    
    /// <summary>
    /// UTC timestamp when the idea was submitted
    /// </summary>
    public DateTime SubmittedDate { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// Current workflow state of the idea
    /// </summary>
    public WorkflowState Status { get; set; } = WorkflowState.Submitted;
    
    /// <summary>
    /// Business case metrics (ROI, effort, risk)
    /// </summary>
    public BusinessCase? BusinessCase { get; set; }
    
    /// <summary>
    /// Actual impact metrics after implementation (JSON)
    /// Example: {"users_impacted": 1000, "revenue_increase": 5000}
    /// </summary>
    [MaxLength(1000)]
    public string? ImpactMetrics { get; set; }
    
    /// <summary>
    /// UTC timestamp of the last update
    /// </summary>
    public DateTime LastModifiedDate { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// Reviewer notes or feedback
    /// </summary>
    [MaxLength(2000)]
    public string? ReviewerNotes { get; set; }
    
    /// <summary>
    /// Calculates similarity score with another idea based on title/description
    /// Uses simple word overlap algorithm (Jaccard similarity)
    /// </summary>
    /// <param name="other">Idea to compare against</param>
    /// <returns>Similarity score from 0 (no match) to 1 (identical)</returns>
    public decimal CalculateSimilarity(Idea other)
    {
        if (other == null) return 0;
        
        var thisWords = GetWords($"{Title} {Description}");
        var otherWords = GetWords($"{other.Title} {other.Description}");
        
        if (thisWords.Count == 0 || otherWords.Count == 0) return 0;
        
        var intersection = thisWords.Intersect(otherWords).Count();
        var union = thisWords.Union(otherWords).Count();
        
        return union == 0 ? 0 : (decimal)intersection / union;
    }
    
    private static HashSet<string> GetWords(string text)
    {
        return text
            .ToLowerInvariant()
            .Split(new[] { ' ', ',', '.', '!', '?', ';', ':' }, StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length > 2) // Filter out very short words
            .ToHashSet();
    }
}
