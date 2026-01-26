using Microsoft.AspNetCore.Mvc;
using IdeaManagement.Models;
using IdeaManagement.Services;
using FluentValidation;

namespace IdeaManagement.Controllers;

/// <summary>
/// API controller for managing ideas
/// </summary>
[ApiController]
[Route("api/v1/[controller]")]
[Produces("application/json")]
public class IdeasController : ControllerBase
{
    private readonly IIdeaService _ideaService;
    private readonly IValidator<Idea> _createValidator;
    private readonly IValidator<Idea> _updateValidator;
    private readonly ILogger<IdeasController> _logger;
    
    public IdeasController(
        IIdeaService ideaService,
        IValidator<Idea> createValidator,
        IValidator<Idea> updateValidator,
        ILogger<IdeasController> logger)
    {
        _ideaService = ideaService ?? throw new ArgumentNullException(nameof(ideaService));
        _createValidator = createValidator ?? throw new ArgumentNullException(nameof(createValidator));
        _updateValidator = updateValidator ?? throw new ArgumentNullException(nameof(updateValidator));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }
    
    /// <summary>
    /// Get all ideas with optional filters
    /// </summary>
    /// <param name="status">Filter by workflow status</param>
    /// <param name="submittedBy">Filter by submitter</param>
    /// <param name="minPriorityScore">Filter by minimum priority score</param>
    /// <returns>List of ideas</returns>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<Idea>>> GetAllIdeas(
        [FromQuery] WorkflowState? status = null,
        [FromQuery] string? submittedBy = null,
        [FromQuery] decimal? minPriorityScore = null)
    {
        _logger.LogInformation("GET /api/v1/ideas called with filters");
        var ideas = await _ideaService.GetAllIdeasAsync(status, submittedBy, minPriorityScore);
        return Ok(ideas);
    }
    
    /// <summary>
    /// Get a specific idea by ID
    /// </summary>
    /// <param name="id">Idea ID</param>
    /// <returns>Idea details</returns>
    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<Idea>> GetIdea(int id)
    {
        _logger.LogInformation("GET /api/v1/ideas/{Id} called", id);
        
        var idea = await _ideaService.GetIdeaByIdAsync(id);
        if (idea == null)
        {
            _logger.LogWarning("Idea with ID={Id} not found", id);
            return NotFound(new { message = $"Idea with ID {id} not found" });
        }
        
        return Ok(idea);
    }
    
    /// <summary>
    /// Create a new idea
    /// </summary>
    /// <param name="idea">Idea details</param>
    /// <returns>Created idea</returns>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<Idea>> CreateIdea([FromBody] Idea idea)
    {
        _logger.LogInformation("POST /api/v1/ideas called");
        
        var validationResult = await _createValidator.ValidateAsync(idea);
        if (!validationResult.IsValid)
        {
            _logger.LogWarning("Validation failed for new idea");
            return BadRequest(new { errors = validationResult.Errors.Select(e => e.ErrorMessage) });
        }
        
        var created = await _ideaService.CreateIdeaAsync(idea);
        return CreatedAtAction(nameof(GetIdea), new { id = created.Id }, created);
    }
    
    /// <summary>
    /// Update an existing idea
    /// </summary>
    /// <param name="id">Idea ID</param>
    /// <param name="idea">Updated idea details</param>
    /// <returns>Updated idea</returns>
    [HttpPut("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<Idea>> UpdateIdea(int id, [FromBody] Idea idea)
    {
        _logger.LogInformation("PUT /api/v1/ideas/{Id} called", id);
        
        if (id != idea.Id)
        {
            _logger.LogWarning("ID mismatch: URL ID={UrlId}, Body ID={BodyId}", id, idea.Id);
            return BadRequest(new { message = "ID in URL does not match ID in request body" });
        }
        
        var validationResult = await _updateValidator.ValidateAsync(idea);
        if (!validationResult.IsValid)
        {
            _logger.LogWarning("Validation failed for idea update");
            return BadRequest(new { errors = validationResult.Errors.Select(e => e.ErrorMessage) });
        }
        
        try
        {
            var updated = await _ideaService.UpdateIdeaAsync(idea);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Idea with ID={Id} not found for update", id);
            return NotFound(new { message = ex.Message });
        }
    }
    
    /// <summary>
    /// Delete an idea
    /// </summary>
    /// <param name="id">Idea ID</param>
    /// <returns>No content on success</returns>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteIdea(int id)
    {
        _logger.LogInformation("DELETE /api/v1/ideas/{Id} called", id);
        
        var deleted = await _ideaService.DeleteIdeaAsync(id);
        if (!deleted)
        {
            _logger.LogWarning("Idea with ID={Id} not found for deletion", id);
            return NotFound(new { message = $"Idea with ID {id} not found" });
        }
        
        return NoContent();
    }
    
    /// <summary>
    /// Transition an idea to a new workflow state
    /// </summary>
    /// <param name="id">Idea ID</param>
    /// <param name="request">Transition request with new state and optional notes</param>
    /// <returns>Updated idea</returns>
    [HttpPost("{id}/transition")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<Idea>> TransitionState(
        int id, 
        [FromBody] StateTransitionRequest request)
    {
        _logger.LogInformation("POST /api/v1/ideas/{Id}/transition called", id);
        
        try
        {
            var updated = await _ideaService.TransitionStateAsync(id, request.NewState, request.ReviewerNotes);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Idea with ID={Id} not found for transition", id);
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Invalid state transition for idea ID={Id}", id);
            return BadRequest(new { message = ex.Message });
        }
    }
    
    /// <summary>
    /// Find ideas similar to the specified idea
    /// </summary>
    /// <param name="id">Idea ID</param>
    /// <param name="threshold">Minimum similarity score (0-1), default 0.3</param>
    /// <returns>List of similar ideas with similarity scores</returns>
    [HttpGet("{id}/similar")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IEnumerable<SimilarIdeaResponse>>> FindSimilarIdeas(
        int id, 
        [FromQuery] decimal threshold = 0.3m)
    {
        _logger.LogInformation("GET /api/v1/ideas/{Id}/similar called with threshold={Threshold}", id, threshold);
        
        try
        {
            var similarIdeas = await _ideaService.FindSimilarIdeasAsync(id, threshold);
            var response = similarIdeas.Select(x => new SimilarIdeaResponse
            {
                Idea = x.idea,
                SimilarityScore = x.similarityScore
            });
            return Ok(response);
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Idea with ID={Id} not found for similarity search", id);
            return NotFound(new { message = ex.Message });
        }
    }
}

/// <summary>
/// Request model for state transitions
/// </summary>
public record StateTransitionRequest
{
    public WorkflowState NewState { get; init; }
    public string? ReviewerNotes { get; init; }
}

/// <summary>
/// Response model for similar idea results
/// </summary>
public record SimilarIdeaResponse
{
    public Idea Idea { get; init; } = null!;
    public decimal SimilarityScore { get; init; }
}
