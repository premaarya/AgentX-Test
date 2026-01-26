using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using IdeaManagement.Data;
using IdeaManagement.Models;
using IdeaManagement.Services;
using Xunit;

namespace IdeaManagement.Tests.UnitTests.Services;

/// <summary>
/// Unit tests for IdeaService business logic
/// </summary>
public class IdeaServiceTests : IDisposable
{
    private readonly IdeaDbContext _context;
    private readonly IdeaService _service;
    private readonly Mock<ILogger<IdeaService>> _loggerMock;
    
    public IdeaServiceTests()
    {
        // Use in-memory database for testing
        var options = new DbContextOptionsBuilder<IdeaDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        
        _context = new IdeaDbContext(options);
        _loggerMock = new Mock<ILogger<IdeaService>>();
        _service = new IdeaService(_context, _loggerMock.Object);
    }
    
    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
    }
    
    [Fact]
    public async Task CreateIdeaAsync_WithValidIdea_ShouldCreateAndReturnIdea()
    {
        // Arrange
        var idea = new Idea
        {
            Title = "New Feature",
            Description = "Add exciting new feature",
            SubmittedBy = "user@example.com"
        };
        
        // Act
        var result = await _service.CreateIdeaAsync(idea);
        
        // Assert
        result.Id.Should().BeGreaterThan(0);
        result.Status.Should().Be(WorkflowState.Submitted);
        result.SubmittedDate.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }
    
    [Fact]
    public async Task CreateIdeaAsync_WithNullIdea_ShouldThrowArgumentNullException()
    {
        // Act
        var act = async () => await _service.CreateIdeaAsync(null!);
        
        // Assert
        await act.Should().ThrowAsync<ArgumentNullException>();
    }
    
    [Fact]
    public async Task GetIdeaByIdAsync_WithExistingId_ShouldReturnIdea()
    {
        // Arrange
        var idea = new Idea
        {
            Title = "Test Idea",
            Description = "Test Description",
            SubmittedBy = "test@example.com"
        };
        _context.Ideas.Add(idea);
        await _context.SaveChangesAsync();
        
        // Act
        var result = await _service.GetIdeaByIdAsync(idea.Id);
        
        // Assert
        result.Should().NotBeNull();
        result!.Title.Should().Be("Test Idea");
    }
    
    [Fact]
    public async Task GetIdeaByIdAsync_WithNonExistingId_ShouldReturnNull()
    {
        // Act
        var result = await _service.GetIdeaByIdAsync(999);
        
        // Assert
        result.Should().BeNull();
    }
    
    [Fact]
    public async Task GetAllIdeasAsync_WithNoFilters_ShouldReturnAllIdeas()
    {
        // Arrange
        _context.Ideas.AddRange(
            new Idea { Title = "Idea 1", Description = "Desc 1", SubmittedBy = "user1@example.com" },
            new Idea { Title = "Idea 2", Description = "Desc 2", SubmittedBy = "user2@example.com" },
            new Idea { Title = "Idea 3", Description = "Desc 3", SubmittedBy = "user1@example.com" }
        );
        await _context.SaveChangesAsync();
        
        // Act
        var result = await _service.GetAllIdeasAsync();
        
        // Assert
        result.Should().HaveCount(3);
    }
    
    [Fact]
    public async Task GetAllIdeasAsync_WithStatusFilter_ShouldReturnFilteredIdeas()
    {
        // Arrange
        var idea1 = new Idea { Title = "Idea 1", Description = "Desc", SubmittedBy = "user@example.com", Status = WorkflowState.Submitted };
        var idea2 = new Idea { Title = "Idea 2", Description = "Desc", SubmittedBy = "user@example.com", Status = WorkflowState.InReview };
        _context.Ideas.AddRange(idea1, idea2);
        await _context.SaveChangesAsync();
        
        // Act
        var result = await _service.GetAllIdeasAsync(status: WorkflowState.Submitted);
        
        // Assert
        result.Should().HaveCount(1);
        result.First().Title.Should().Be("Idea 1");
    }
    
    [Fact]
    public async Task GetAllIdeasAsync_WithSubmittedByFilter_ShouldReturnFilteredIdeas()
    {
        // Arrange
        _context.Ideas.AddRange(
            new Idea { Title = "Idea 1", Description = "Desc", SubmittedBy = "alice@example.com" },
            new Idea { Title = "Idea 2", Description = "Desc", SubmittedBy = "bob@example.com" },
            new Idea { Title = "Idea 3", Description = "Desc", SubmittedBy = "alice@example.com" }
        );
        await _context.SaveChangesAsync();
        
        // Act
        var result = await _service.GetAllIdeasAsync(submittedBy: "alice@example.com");
        
        // Assert
        result.Should().HaveCount(2);
    }
    
    [Fact]
    public async Task GetAllIdeasAsync_WithMinPriorityScoreFilter_ShouldReturnFilteredIdeas()
    {
        // Arrange
        _context.Ideas.AddRange(
            new Idea 
            { 
                Title = "High Priority", 
                Description = "Desc", 
                SubmittedBy = "user@example.com",
                BusinessCase = BusinessCase.Create(500, 10, RiskLevel.Low) // Score = 50
            },
            new Idea 
            { 
                Title = "Low Priority", 
                Description = "Desc", 
                SubmittedBy = "user@example.com",
                BusinessCase = BusinessCase.Create(10, 1000, RiskLevel.High) // Score = 0.006
            }
        );
        await _context.SaveChangesAsync();
        
        // Act
        var result = await _service.GetAllIdeasAsync(minPriorityScore: 1m);
        
        // Assert
        result.Should().HaveCount(1);
        result.First().Title.Should().Be("High Priority");
    }
    
    [Fact]
    public async Task UpdateIdeaAsync_WithExistingIdea_ShouldUpdateFields()
    {
        // Arrange
        var idea = new Idea
        {
            Title = "Original Title",
            Description = "Original Description",
            SubmittedBy = "user@example.com"
        };
        _context.Ideas.Add(idea);
        await _context.SaveChangesAsync();
        
        idea.Title = "Updated Title";
        idea.Description = "Updated Description";
        
        // Act
        var result = await _service.UpdateIdeaAsync(idea);
        
        // Assert
        result.Title.Should().Be("Updated Title");
        result.Description.Should().Be("Updated Description");
        result.LastModifiedDate.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }
    
    [Fact]
    public async Task UpdateIdeaAsync_WithNonExistingIdea_ShouldThrowKeyNotFoundException()
    {
        // Arrange
        var idea = new Idea
        {
            Id = 999,
            Title = "Test",
            Description = "Test",
            SubmittedBy = "user@example.com"
        };
        
        // Act
        var act = async () => await _service.UpdateIdeaAsync(idea);
        
        // Assert
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }
    
    [Fact]
    public async Task DeleteIdeaAsync_WithExistingId_ShouldDeleteAndReturnTrue()
    {
        // Arrange
        var idea = new Idea
        {
            Title = "To Delete",
            Description = "Will be deleted",
            SubmittedBy = "user@example.com"
        };
        _context.Ideas.Add(idea);
        await _context.SaveChangesAsync();
        var ideaId = idea.Id;
        
        // Act
        var result = await _service.DeleteIdeaAsync(ideaId);
        
        // Assert
        result.Should().BeTrue();
        var deletedIdea = await _context.Ideas.FindAsync(ideaId);
        deletedIdea.Should().BeNull();
    }
    
    [Fact]
    public async Task DeleteIdeaAsync_WithNonExistingId_ShouldReturnFalse()
    {
        // Act
        var result = await _service.DeleteIdeaAsync(999);
        
        // Assert
        result.Should().BeFalse();
    }
    
    [Theory]
    [InlineData(WorkflowState.Submitted, WorkflowState.InReview, true)]
    [InlineData(WorkflowState.InReview, WorkflowState.Approved, true)]
    [InlineData(WorkflowState.InReview, WorkflowState.NotApproved, true)]
    [InlineData(WorkflowState.Approved, WorkflowState.InDevelopment, true)]
    [InlineData(WorkflowState.InDevelopment, WorkflowState.InProduction, true)]
    [InlineData(WorkflowState.Submitted, WorkflowState.Approved, false)]
    [InlineData(WorkflowState.NotApproved, WorkflowState.InReview, false)]
    [InlineData(WorkflowState.InProduction, WorkflowState.InDevelopment, false)]
    public async Task TransitionStateAsync_WithVariousTransitions_ShouldValidateCorrectly(
        WorkflowState currentState, 
        WorkflowState newState, 
        bool shouldSucceed)
    {
        // Arrange
        var idea = new Idea
        {
            Title = "Test Idea",
            Description = "Test",
            SubmittedBy = "user@example.com",
            Status = currentState
        };
        _context.Ideas.Add(idea);
        await _context.SaveChangesAsync();
        
        // Act
        if (shouldSucceed)
        {
            var result = await _service.TransitionStateAsync(idea.Id, newState);
            
            // Assert
            result.Status.Should().Be(newState);
        }
        else
        {
            var act = async () => await _service.TransitionStateAsync(idea.Id, newState);
            
            // Assert
            await act.Should().ThrowAsync<InvalidOperationException>();
        }
    }
    
    [Fact]
    public async Task TransitionStateAsync_WithReviewerNotes_ShouldAddNotes()
    {
        // Arrange
        var idea = new Idea
        {
            Title = "Test",
            Description = "Test",
            SubmittedBy = "user@example.com",
            Status = WorkflowState.Submitted
        };
        _context.Ideas.Add(idea);
        await _context.SaveChangesAsync();
        
        // Act
        var result = await _service.TransitionStateAsync(
            idea.Id, 
            WorkflowState.InReview, 
            "Looks promising, needs more detail");
        
        // Assert
        result.ReviewerNotes.Should().Be("Looks promising, needs more detail");
    }
    
    [Fact]
    public async Task FindSimilarIdeasAsync_WithSimilarIdeas_ShouldReturnMatches()
    {
        // Arrange
        var targetIdea = new Idea
        {
            Title = "Dashboard Performance Dashboard",
            Description = "Optimize dashboard loading speed dashboard performance data handling",
            SubmittedBy = "user1@example.com"
        };
        
        var similarIdea = new Idea
        {
            Title = "Dashboard Speed Dashboard",
            Description = "Make dashboard faster dashboard better performance management",
            SubmittedBy = "user2@example.com"
        };
        
        var differentIdea = new Idea
        {
            Title = "Database Migration",
            Description = "Migrate from MySQL to PostgreSQL",
            SubmittedBy = "user3@example.com"
        };
        
        _context.Ideas.AddRange(targetIdea, similarIdea, differentIdea);
        await _context.SaveChangesAsync();
        
        // Act
        var result = await _service.FindSimilarIdeasAsync(targetIdea.Id, threshold: 0.2m);
        
        // Assert
        result.Should().NotBeEmpty();
        // The similar idea should have higher score than the different one
        var simScore = targetIdea.CalculateSimilarity(similarIdea);
        var diffScore = targetIdea.CalculateSimilarity(differentIdea);
        simScore.Should().BeGreaterThan(diffScore);
    }
    
    [Fact]
    public async Task FindSimilarIdeasAsync_WithNonExistingId_ShouldThrowKeyNotFoundException()
    {
        // Act
        var act = async () => await _service.FindSimilarIdeasAsync(999);
        
        // Assert
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }
}
