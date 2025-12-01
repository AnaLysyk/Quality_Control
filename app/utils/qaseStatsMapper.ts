export function mapStats(stats: any) {
    return {
        pass: stats?.passed ?? stats?.pass ?? 0,
        fail: stats?.failed ?? stats?.fail ?? 0,
        blocked: stats?.blocked ?? 0,
        notRun: stats?.untested ?? stats?.notRun ?? 0,
    };
}
