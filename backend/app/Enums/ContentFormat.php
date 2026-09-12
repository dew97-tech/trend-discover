<?php

namespace App\Enums;

enum ContentFormat: string
{
    case QuickTip = 'quick_tip';
    case SqlHack = 'sql_hack';
    case LaravelHack = 'laravel_hack';
    case ReactHack = 'react_hack';
    case NextJsHack = 'nextjs_hack';
    case TechnicalInsight = 'technical_insight';
    case OptimizationTip = 'optimization_tip';
    case ProblemSolution = 'problem_solution';
    case BeforeAfter = 'before_after';
    case EngineeringLesson = 'engineering_lesson';
    case ReleaseHighlight = 'release_highlight';
    case ToolDiscovery = 'tool_discovery';
    case PerformanceBreakdown = 'performance_breakdown';
    case ArchitectureInsight = 'architecture_insight';
    case DebuggingStory = 'debugging_story';
    case DeveloperDebate = 'developer_debate';
    case CaseStudy = 'case_study';

    public function label(): string
    {
        return match ($this) {
            self::QuickTip => 'Quick Tip',
            self::SqlHack => 'SQL Hack',
            self::LaravelHack => 'Laravel Hack',
            self::ReactHack => 'React Hack',
            self::NextJsHack => 'Next.js Hack',
            self::TechnicalInsight => 'Technical Insight',
            self::OptimizationTip => 'Optimization Tip',
            self::ProblemSolution => 'Problem → Solution',
            self::BeforeAfter => 'Before → After',
            self::EngineeringLesson => 'Engineering Lesson',
            self::ReleaseHighlight => 'Release Highlight',
            self::ToolDiscovery => 'Tool Discovery',
            self::PerformanceBreakdown => 'Performance Breakdown',
            self::ArchitectureInsight => 'Architecture Insight',
            self::DebuggingStory => 'Debugging Story',
            self::DeveloperDebate => 'Developer Debate',
            self::CaseStudy => 'Case Study',
        };
    }
}
