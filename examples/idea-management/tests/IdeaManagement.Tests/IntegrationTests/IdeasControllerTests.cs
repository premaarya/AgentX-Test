using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using IdeaManagement.Data;
using IdeaManagement.Models;
using Xunit;

namespace IdeaManagement.Tests.IntegrationTests;

/// <summary>
/// Integration tests for IdeasController API endpoints
/// </summary>
public class IdeasControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    
    public IdeasControllerTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                // Remove the existing DbContext registration
                var descriptor = services.SingleOrDefault(
                    d => d.ServiceType == typeof(DbContextOptions<IdeaDbContext>));
                
                if (descriptor != null)
                {
                    services.Remove(descriptor);
                }
                
                // Add in-memory database for testing
                services.AddDbContext<IdeaDbContext>(options =>
                {
                    options.UseInMemoryDatabase("TestDatabase_" + Guid.NewGuid());
                });
                
                // Ensure database is created
                var sp = services.BuildServiceProvider();
                using var scope = sp.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IdeaDbContext>();
                db.Database.EnsureCreated();
            });
        });
        
        _client = _factory.CreateClient();
    }
    
    [Fact]
    public async Task GetAllIdeas_WhenNoIdeas_ShouldReturnEmptyList()
    {
        // Act
        var response = await _client.GetAsync("/api/v1/ideas");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var ideas = await response.Content.ReadFromJsonAsync<List<Idea>>();
        ideas.Should().NotBeNull().And.BeEmpty();
    }
    
    [Fact]
    public async Task CreateIdea_WithValidData_ShouldReturn201Created()
    {
        // Arrange
        var newIdea = new Idea
        {
            Title = "Integration Test Idea",
            Description = "Testing the API endpoint",
            SubmittedBy = "tester@example.com",
            BusinessCase = BusinessCase.Create(150, 100, RiskLevel.Low)
        };
        
        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/ideas", newIdea);
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<Idea>();
        created.Should().NotBeNull();
        created!.Id.Should().BeGreaterThan(0);
        created.Title.Should().Be("Integration Test Idea");
    }
    
    [Fact]
    public async Task CreateIdea_WithInvalidData_ShouldReturn400BadRequest()
    {
        // Arrange - Missing required Title
        var invalidIdea = new Idea
        {
            Description = "Missing title",
            SubmittedBy = "tester@example.com"
        };
        
        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/ideas", invalidIdea);
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
    
    [Fact]
    public async Task GetIdea_WithExistingId_ShouldReturn200OK()
    {
        // Arrange - Create an idea first
        var newIdea = new Idea
        {
            Title = "Test Idea",
            Description = "For retrieval test",
            SubmittedBy = "tester@example.com"
        };
        var createResponse = await _client.PostAsJsonAsync("/api/v1/ideas", newIdea);
        var created = await createResponse.Content.ReadFromJsonAsync<Idea>();
        
        // Act
        var response = await _client.GetAsync($"/api/v1/ideas/{created!.Id}");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var retrieved = await response.Content.ReadFromJsonAsync<Idea>();
        retrieved.Should().NotBeNull();
        retrieved!.Title.Should().Be("Test Idea");
    }
    
    [Fact]
    public async Task GetIdea_WithNonExistingId_ShouldReturn404NotFound()
    {
        // Act
        var response = await _client.GetAsync("/api/v1/ideas/99999");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
    
    [Fact]
    public async Task UpdateIdea_WithValidData_ShouldReturn200OK()
    {
        // Arrange - Create an idea first
        var newIdea = new Idea
        {
            Title = "Original Title",
            Description = "Original Description",
            SubmittedBy = "tester@example.com"
        };
        var createResponse = await _client.PostAsJsonAsync("/api/v1/ideas", newIdea);
        var created = await createResponse.Content.ReadFromJsonAsync<Idea>();
        
        created!.Title = "Updated Title";
        created.Description = "Updated Description";
        
        // Act
        var response = await _client.PutAsJsonAsync($"/api/v1/ideas/{created.Id}", created);
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await response.Content.ReadFromJsonAsync<Idea>();
        updated!.Title.Should().Be("Updated Title");
        updated.Description.Should().Be("Updated Description");
    }
    
    [Fact]
    public async Task DeleteIdea_WithExistingId_ShouldReturn204NoContent()
    {
        // Arrange - Create an idea first
        var newIdea = new Idea
        {
            Title = "To Delete",
            Description = "Will be deleted",
            SubmittedBy = "tester@example.com"
        };
        var createResponse = await _client.PostAsJsonAsync("/api/v1/ideas", newIdea);
        var created = await createResponse.Content.ReadFromJsonAsync<Idea>();
        
        // Act
        var response = await _client.DeleteAsync($"/api/v1/ideas/{created!.Id}");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        
        // Verify it's actually deleted
        var getResponse = await _client.GetAsync($"/api/v1/ideas/{created.Id}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
    
    [Fact]
    public async Task TransitionState_WithValidTransition_ShouldReturn200OK()
    {
        // Arrange - Create an idea in Submitted state
        var newIdea = new Idea
        {
            Title = "State Transition Test",
            Description = "Testing workflow transitions",
            SubmittedBy = "tester@example.com"
        };
        var createResponse = await _client.PostAsJsonAsync("/api/v1/ideas", newIdea);
        var created = await createResponse.Content.ReadFromJsonAsync<Idea>();
        
        var transitionRequest = new
        {
            NewState = WorkflowState.InReview,
            ReviewerNotes = "Looks promising"
        };
        
        // Act
        var response = await _client.PostAsJsonAsync(
            $"/api/v1/ideas/{created!.Id}/transition", 
            transitionRequest);
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await response.Content.ReadFromJsonAsync<Idea>();
        updated!.Status.Should().Be(WorkflowState.InReview);
        updated.ReviewerNotes.Should().Be("Looks promising");
    }
    
    [Fact]
    public async Task TransitionState_WithInvalidTransition_ShouldReturn400BadRequest()
    {
        // Arrange - Create an idea in Submitted state
        var newIdea = new Idea
        {
            Title = "Invalid Transition Test",
            Description = "Testing invalid workflow transition",
            SubmittedBy = "tester@example.com"
        };
        var createResponse = await _client.PostAsJsonAsync("/api/v1/ideas", newIdea);
        var created = await createResponse.Content.ReadFromJsonAsync<Idea>();
        
        var invalidTransition = new
        {
            NewState = WorkflowState.InProduction, // Can't go directly from Submitted to InProduction
            ReviewerNotes = "Invalid"
        };
        
        // Act
        var response = await _client.PostAsJsonAsync(
            $"/api/v1/ideas/{created!.Id}/transition", 
            invalidTransition);
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
    
    [Fact]
    public async Task FindSimilarIdeas_WithExistingIdea_ShouldReturnSimilarMatches()
    {
        // Arrange - Create multiple ideas
        var idea1 = new Idea
        {
            Title = "Dashboard Performance",
            Description = "Improve loading speed of user dashboard",
            SubmittedBy = "user1@example.com"
        };
        var idea2 = new Idea
        {
            Title = "Dashboard Speed Enhancement",
            Description = "Make dashboard load faster for users",
            SubmittedBy = "user2@example.com"
        };
        var idea3 = new Idea
        {
            Title = "Database Migration",
            Description = "Migrate to PostgreSQL",
            SubmittedBy = "user3@example.com"
        };
        
        var response1 = await _client.PostAsJsonAsync("/api/v1/ideas", idea1);
        var response2 = await _client.PostAsJsonAsync("/api/v1/ideas", idea2);
        await _client.PostAsJsonAsync("/api/v1/ideas", idea3);
        
        var created1 = await response1.Content.ReadFromJsonAsync<Idea>();
        
        // Act
        var response = await _client.GetAsync($"/api/v1/ideas/{created1!.Id}/similar?threshold=0.3");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var similarIdeas = await response.Content.ReadFromJsonAsync<List<dynamic>>();
        similarIdeas.Should().NotBeNull().And.NotBeEmpty();
    }
    
    [Fact]
    public async Task GetAllIdeas_WithStatusFilter_ShouldReturnFilteredResults()
    {
        // Arrange - Create ideas with different statuses
        var idea1 = new Idea
        {
            Title = "Submitted Idea",
            Description = "Test",
            SubmittedBy = "user@example.com",
            Status = WorkflowState.Submitted
        };
        var idea2 = new Idea
        {
            Title = "Another Submitted",
            Description = "Test",
            SubmittedBy = "user@example.com",
            Status = WorkflowState.Submitted
        };
        
        await _client.PostAsJsonAsync("/api/v1/ideas", idea1);
        var response2 = await _client.PostAsJsonAsync("/api/v1/ideas", idea2);
        var created2 = await response2.Content.ReadFromJsonAsync<Idea>();
        
        // Transition one to InReview
        await _client.PostAsJsonAsync(
            $"/api/v1/ideas/{created2!.Id}/transition",
            new { NewState = WorkflowState.InReview });
        
        // Act
        var response = await _client.GetAsync("/api/v1/ideas?status=Submitted");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var ideas = await response.Content.ReadFromJsonAsync<List<Idea>>();
        ideas.Should().HaveCount(1);
        ideas![0].Status.Should().Be(WorkflowState.Submitted);
    }
}
