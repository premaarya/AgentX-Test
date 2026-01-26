using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using IdeaManagement.Data;
using IdeaManagement.Models;
using Xunit;

namespace IdeaManagement.Tests.E2ETests;

/// <summary>
/// End-to-end tests for complete idea workflows
/// </summary>
public class IdeaWorkflowTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    
    public IdeaWorkflowTests(WebApplicationFactory<Program> factory)
    {
        var testFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var descriptor = services.SingleOrDefault(
                    d => d.ServiceType == typeof(DbContextOptions<IdeaDbContext>));
                
                if (descriptor != null)
                {
                    services.Remove(descriptor);
                }
                
                services.AddDbContext<IdeaDbContext>(options =>
                {
                    options.UseInMemoryDatabase("E2ETestDatabase_" + Guid.NewGuid());
                });
                
                var sp = services.BuildServiceProvider();
                using var scope = sp.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IdeaDbContext>();
                db.Database.EnsureCreated();
            });
        });
        
        _client = testFactory.CreateClient();
    }
    
    [Fact]
    public async Task CompleteIdeaWorkflow_FromSubmissionToProduction_ShouldSucceed()
    {
        // Step 1: Submit a new idea
        var newIdea = new Idea
        {
            Title = "AI-Powered Search",
            Description = "Implement semantic search using AI to improve user experience",
            SubmittedBy = "product@example.com",
            BusinessCase = BusinessCase.Create(300, 200, RiskLevel.Medium)
        };
        
        var createResponse = await _client.PostAsJsonAsync("/api/v1/ideas", newIdea);
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var idea = await createResponse.Content.ReadFromJsonAsync<Idea>();
        idea.Should().NotBeNull();
        idea!.Status.Should().Be(WorkflowState.Submitted);
        
        // Step 2: Transition to InReview
        var reviewTransition = new { NewState = WorkflowState.InReview, ReviewerNotes = "Promising idea, needs feasibility check" };
        var reviewResponse = await _client.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/transition", reviewTransition);
        reviewResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var reviewedIdea = await reviewResponse.Content.ReadFromJsonAsync<Idea>();
        reviewedIdea!.Status.Should().Be(WorkflowState.InReview);
        
        // Step 3: Approve the idea
        var approveTransition = new { NewState = WorkflowState.Approved, ReviewerNotes = "Approved for Q2 development" };
        var approveResponse = await _client.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/transition", approveTransition);
        approveResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var approvedIdea = await approveResponse.Content.ReadFromJsonAsync<Idea>();
        approvedIdea!.Status.Should().Be(WorkflowState.Approved);
        
        // Step 4: Move to Development
        var devTransition = new { NewState = WorkflowState.InDevelopment };
        var devResponse = await _client.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/transition", devTransition);
        devResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var devIdea = await devResponse.Content.ReadFromJsonAsync<Idea>();
        devIdea!.Status.Should().Be(WorkflowState.InDevelopment);
        
        // Step 5: Deploy to Production
        var prodTransition = new { NewState = WorkflowState.InProduction };
        var prodResponse = await _client.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/transition", prodTransition);
        prodResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var prodIdea = await prodResponse.Content.ReadFromJsonAsync<Idea>();
        prodIdea!.Status.Should().Be(WorkflowState.InProduction);
        
        // Step 6: Update with impact metrics
        prodIdea.ImpactMetrics = "{\"users_impacted\": 5000, \"revenue_increase\": 15000, \"performance_gain\": \"40%\"}";
        var updateResponse = await _client.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}", prodIdea);
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var finalIdea = await updateResponse.Content.ReadFromJsonAsync<Idea>();
        finalIdea!.ImpactMetrics.Should().Contain("users_impacted");
    }
    
    [Fact]
    public async Task RejectedIdeaWorkflow_ShouldTerminateAtNotApproved()
    {
        // Step 1: Submit idea
        var newIdea = new Idea
        {
            Title = "Legacy System Replacement",
            Description = "Replace old system entirely",
            SubmittedBy = "dev@example.com",
            BusinessCase = BusinessCase.Create(50, 5000, RiskLevel.High)
        };
        
        var createResponse = await _client.PostAsJsonAsync("/api/v1/ideas", newIdea);
        var idea = await createResponse.Content.ReadFromJsonAsync<Idea>();
        
        // Step 2: Move to review
        var reviewTransition = new { NewState = WorkflowState.InReview };
        await _client.PostAsJsonAsync($"/api/v1/ideas/{idea!.Id}/transition", reviewTransition);
        
        // Step 3: Reject the idea
        var rejectTransition = new { NewState = WorkflowState.NotApproved, ReviewerNotes = "ROI too low, risk too high" };
        var rejectResponse = await _client.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/transition", rejectTransition);
        rejectResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var rejectedIdea = await rejectResponse.Content.ReadFromJsonAsync<Idea>();
        rejectedIdea!.Status.Should().Be(WorkflowState.NotApproved);
        
        // Step 4: Verify cannot transition from NotApproved (terminal state)
        var invalidTransition = new { NewState = WorkflowState.InDevelopment };
        var invalidResponse = await _client.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/transition", invalidTransition);
        invalidResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
    
    [Fact]
    public async Task MultipleIdeasWithPrioritization_ShouldFilterByPriorityScore()
    {
        // Create multiple ideas with different business cases
        var ideas = new[]
        {
            new Idea
            {
                Title = "Quick Win Feature",
                Description = "Low effort, high return",
                SubmittedBy = "pm@example.com",
                BusinessCase = BusinessCase.Create(500, 50, RiskLevel.Low) // High priority score
            },
            new Idea
            {
                Title = "Complex Migration",
                Description = "High effort, low return",
                SubmittedBy = "pm@example.com",
                BusinessCase = BusinessCase.Create(100, 2000, RiskLevel.High) // Low priority score
            },
            new Idea
            {
                Title = "Moderate Feature",
                Description = "Moderate effort and return",
                SubmittedBy = "pm@example.com",
                BusinessCase = BusinessCase.Create(200, 150, RiskLevel.Medium) // Medium priority score
            }
        };
        
        foreach (var idea in ideas)
        {
            await _client.PostAsJsonAsync("/api/v1/ideas", idea);
        }
        
        // Filter by minimum priority score
        var response = await _client.GetAsync("/api/v1/ideas?minPriorityScore=1");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var highPriorityIdeas = await response.Content.ReadFromJsonAsync<List<Idea>>();
        highPriorityIdeas.Should().NotBeNull();
        highPriorityIdeas!.Should().HaveCountGreaterThan(0);
        highPriorityIdeas.All(i => i.BusinessCase!.PriorityScore >= 1m).Should().BeTrue();
    }
    
    [Fact]
    public async Task SimilarIdeasDetection_ShouldPreventDuplicates()
    {
        // Submit first idea
        var originalIdea = new Idea
        {
            Title = "Mobile App Push Notifications",
            Description = "Add push notification support to mobile application for better user engagement",
            SubmittedBy = "user1@example.com"
        };
        
        var response1 = await _client.PostAsJsonAsync("/api/v1/ideas", originalIdea);
        var created1 = await response1.Content.ReadFromJsonAsync<Idea>();
        
        // Submit similar idea
        var similarIdea = new Idea
        {
            Title = "Push Notifications for Mobile",
            Description = "Implement push notifications in mobile app to increase user engagement",
            SubmittedBy = "user2@example.com"
        };
        
        var response2 = await _client.PostAsJsonAsync("/api/v1/ideas", similarIdea);
        var created2 = await response2.Content.ReadFromJsonAsync<Idea>();
        
        // Check for similar ideas before approval
        var similarityResponse = await _client.GetAsync($"/api/v1/ideas/{created2!.Id}/similar?threshold=0.4");
        similarityResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var similarResults = await similarityResponse.Content.ReadFromJsonAsync<List<dynamic>>();
        similarResults.Should().NotBeNull().And.NotBeEmpty();
        // This should flag the original idea as similar, allowing reviewers to merge or reject
    }
}
